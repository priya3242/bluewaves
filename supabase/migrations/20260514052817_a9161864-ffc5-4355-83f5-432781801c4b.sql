
-- Trips
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  trip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  trip_time TIME,
  base_fare NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Passengers
CREATE TABLE public.passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  fare NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash', -- cash | upi | pending
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending | paid
  linked_sms_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Expenses
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- fuel | food | maintenance | other
  amount NUMERIC(10,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SMS messages (webhook ingest)
CREATE TABLE public.sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- nullable: webhook is unauth, assigned to single admin via trigger
  from_number TEXT,
  text TEXT NOT NULL,
  sent_stamp BIGINT,
  received_stamp BIGINT,
  sim TEXT,
  is_upi BOOLEAN NOT NULL DEFAULT false,
  amount NUMERIC(10,2),
  upi_ref TEXT,
  upi_id TEXT,
  bank_from TEXT,
  bank_to TEXT,
  sender_name TEXT,
  linked_passenger_id UUID REFERENCES public.passengers(id) ON DELETE SET NULL,
  raw JSONB,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key for linked_sms_id (after sms_messages exists)
ALTER TABLE public.passengers
  ADD CONSTRAINT passengers_linked_sms_fk
  FOREIGN KEY (linked_sms_id) REFERENCES public.sms_messages(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_trips_user_date ON public.trips(user_id, trip_date DESC);
CREATE INDEX idx_passengers_trip ON public.passengers(trip_id);
CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);
CREATE INDEX idx_sms_user_received ON public.sms_messages(user_id, received_at DESC);
CREATE INDEX idx_sms_is_upi ON public.sms_messages(is_upi) WHERE is_upi = true;

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_passengers_updated BEFORE UPDATE ON public.passengers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-assign incoming SMS to the first (single-admin) user
CREATE OR REPLACE FUNCTION public.assign_sms_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT id INTO NEW.user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_sms_assign_admin BEFORE INSERT ON public.sms_messages
  FOR EACH ROW EXECUTE FUNCTION public.assign_sms_to_admin();

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (owner-only)
CREATE POLICY "trips_owner_all" ON public.trips FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "passengers_owner_all" ON public.passengers FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "expenses_owner_all" ON public.expenses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sms_owner_all" ON public.sms_messages FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
