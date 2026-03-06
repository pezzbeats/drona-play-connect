
-- ============================================================
-- SCHEMA HARDENING MIGRATION
-- Part A: Additional performance indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_deliveries_over_order
  ON public.deliveries(over_id, delivery_no);

CREATE INDEX IF NOT EXISTS idx_deliveries_match_innings
  ON public.deliveries(match_id, innings_no);

CREATE INDEX IF NOT EXISTS idx_prediction_windows_match_status
  ON public.prediction_windows(match_id, status);

CREATE INDEX IF NOT EXISTS idx_predictions_match_mobile
  ON public.predictions(match_id, mobile);

CREATE INDEX IF NOT EXISTS idx_leaderboard_match_points
  ON public.leaderboard(match_id, total_points DESC);

CREATE INDEX IF NOT EXISTS idx_over_control_match_innings_status
  ON public.over_control(match_id, innings_no, status);

-- ============================================================
-- Part B: Missing non-negative value constraints
-- ============================================================

ALTER TABLE public.payment_collections
  ADD CONSTRAINT chk_payment_collections_amount_nonneg CHECK (amount >= 0);

ALTER TABLE public.order_seat_pricing
  ADD CONSTRAINT chk_order_seat_pricing_price_nonneg CHECK (price_applied >= 0);

ALTER TABLE public.deliveries
  ADD CONSTRAINT chk_deliveries_runs_nonneg
    CHECK (runs_off_bat >= 0 AND extras_runs >= 0);

-- ============================================================
-- Part C: Unique delivery number within an over
-- ============================================================

ALTER TABLE public.deliveries
  ADD CONSTRAINT uq_delivery_in_over UNIQUE (over_id, delivery_no);

-- ============================================================
-- Part D: RPC — set_active_match(p_match_id uuid)
-- Atomically deactivates all matches then activates one.
-- Pass NULL to deactivate all (close registrations).
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_active_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deactivate all first (atomic within same transaction)
  UPDATE public.matches
  SET is_active_for_registration = false
  WHERE is_active_for_registration = true;

  -- If a specific match is requested, activate it
  IF p_match_id IS NOT NULL THEN
    UPDATE public.matches
    SET is_active_for_registration = true
    WHERE id = p_match_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Match % not found', p_match_id;
    END IF;
  END IF;
END;
$$;

-- Only authenticated admins can call this RPC
REVOKE ALL ON FUNCTION public.set_active_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_active_match(uuid) TO authenticated;

-- ============================================================
-- Part E: RPC — mark_ticket_checkin(p_ticket_id uuid, p_admin_id uuid)
-- Atomically marks a ticket as used and records check-in audit.
-- Returns the updated ticket row as JSONB.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_ticket_checkin(
  p_ticket_id uuid,
  p_admin_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  -- Lock the row to prevent double check-in races
  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % not found', p_ticket_id;
  END IF;

  IF v_ticket.status = 'used' THEN
    RAISE EXCEPTION 'Ticket % has already been checked in', p_ticket_id;
  END IF;

  IF v_ticket.status = 'blocked' THEN
    RAISE EXCEPTION 'Ticket % is blocked: %', p_ticket_id, v_ticket.blocked_reason;
  END IF;

  -- Perform the check-in update
  UPDATE public.tickets
  SET
    status                  = 'used',
    checked_in_at           = now(),
    checked_in_by_admin_id  = p_admin_id
  WHERE id = p_ticket_id
  RETURNING * INTO v_ticket;

  RETURN row_to_json(v_ticket)::jsonb;
END;
$$;

-- Only authenticated admins can call this RPC
REVOKE ALL ON FUNCTION public.mark_ticket_checkin(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_ticket_checkin(uuid, uuid) TO authenticated;

-- ============================================================
-- Part F: RPC — compute_pricing_quote(p_mobile, p_match_id, p_seats_count)
-- Pure-read SECURITY DEFINER replicating the pricing-quote edge function.
-- Returns JSONB: { seats, total, is_returning, loyalty_seat_cap }
-- ============================================================

CREATE OR REPLACE FUNCTION public.compute_pricing_quote(
  p_mobile      text,
  p_match_id    uuid,
  p_seats_count int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule              public.match_pricing_rules%ROWTYPE;
  v_base_new          int;
  v_base_returning    int;
  v_loyalty_match_id  uuid;
  v_loyalty_seat_cap  int := 0;
  v_is_returning      boolean;
  v_seats             jsonb := '[]'::jsonb;
  v_total             int := 0;
  v_price             int;
  v_reason            text;
  v_i                 int;
  v_past_count        int;
BEGIN
  -- Fetch pricing rule for this match
  SELECT * INTO v_rule
  FROM public.match_pricing_rules
  WHERE match_id = p_match_id
  LIMIT 1;

  v_base_new         := COALESCE(v_rule.base_price_new, 500);
  v_base_returning   := COALESCE(v_rule.base_price_returning, v_base_new);
  v_loyalty_match_id := v_rule.loyalty_from_match_id;

  IF v_loyalty_match_id IS NOT NULL THEN
    -- Loyalty pricing: returning rate applies up to seats from the linked match
    SELECT COALESCE(SUM(seats_count), 0) INTO v_loyalty_seat_cap
    FROM public.orders
    WHERE purchaser_mobile = p_mobile
      AND match_id = v_loyalty_match_id
      AND payment_status IN ('paid_verified', 'paid_manual_verified');
  ELSE
    -- Standard returning: any prior verified order for a different match
    SELECT COUNT(*) INTO v_past_count
    FROM public.orders
    WHERE purchaser_mobile = p_mobile
      AND match_id <> p_match_id
      AND payment_status IN ('paid_verified', 'paid_manual_verified');

    IF v_past_count > 0 THEN
      v_loyalty_seat_cap := p_seats_count; -- all seats at returning rate
    END IF;
  END IF;

  v_is_returning := (v_loyalty_seat_cap > 0);

  -- Build per-seat breakdown
  FOR v_i IN 0..(p_seats_count - 1) LOOP
    IF v_is_returning AND v_i < v_loyalty_seat_cap THEN
      v_price  := v_base_returning;
      v_reason := 'loyal_base';
    ELSE
      v_price  := v_base_new;
      v_reason := CASE WHEN v_is_returning THEN 'extra_seat' ELSE 'new_customer' END;
    END IF;

    v_seats := v_seats || jsonb_build_object(
      'seat_index', v_i,
      'price',      v_price,
      'reason',     v_reason
    );
    v_total := v_total + v_price;
  END LOOP;

  RETURN jsonb_build_object(
    'seats',             v_seats,
    'total',             v_total,
    'is_returning',      v_is_returning,
    'loyalty_seat_cap',  v_loyalty_seat_cap
  );
END;
$$;

-- Publicly callable (no auth needed for pricing preview)
REVOKE ALL ON FUNCTION public.compute_pricing_quote(text, uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_pricing_quote(text, uuid, int) TO anon, authenticated;

-- ============================================================
-- Part G: RPC — get_order_with_tickets(p_mobile text, p_match_id uuid)
-- Safe lookup of order + tickets for a mobile/match combination.
-- Returns JSONB: { order: {...}, tickets: [...] }
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_order_with_tickets(
  p_mobile   text,
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order   public.orders%ROWTYPE;
  v_tickets jsonb;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE purchaser_mobile = p_mobile
    AND match_id = p_match_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('order', null, 'tickets', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(t ORDER BY t.seat_index), '[]'::jsonb)
  INTO v_tickets
  FROM public.tickets t
  WHERE t.order_id = v_order.id;

  RETURN jsonb_build_object(
    'order',   row_to_json(v_order)::jsonb,
    'tickets', v_tickets
  );
END;
$$;

-- Publicly callable (needed for ticket lookup page without auth)
REVOKE ALL ON FUNCTION public.get_order_with_tickets(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_with_tickets(text, uuid) TO anon, authenticated;
