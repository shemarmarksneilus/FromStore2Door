CREATE EXTENSION IF NOT EXISTS citext;

-- =============== ENUM TYPES =================
CREATE TYPE account_role_enum           AS ENUM ('customer', 'driver', 'staff', 'admin');
CREATE TYPE package_status_enum         AS ENUM ('pre_alert', 'received', 'in_warehouse', 'cleared', 'out_for_delivery', 'delivered', 'returned');
CREATE TYPE manifest_status_enum        AS ENUM ('draft', 'in_transit', 'arrived', 'cleared', 'deconsolidated');
CREATE TYPE delivery_result_enum        AS ENUM ('delivered', 'failed', 'rescheduled');
CREATE TYPE notification_channel_enum   AS ENUM ('email', 'sms', 'push', 'in_app');
CREATE TYPE warehouse_type_enum         AS ENUM ('local', 'overseas');
CREATE TYPE api_provider_enum           AS ENUM ('extensiv', 'logiwa', 'camelot', 'softeon', 'magaya', 'generic_json', 'csv_ftp');
CREATE TYPE expense_category_enum       AS ENUM ('fuel', 'maintenance', 'salary', 'utilities', 'other');

-- =============== CORE IDENTITY =================
CREATE TABLE accounts (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid       text UNIQUE,
    email              citext UNIQUE NOT NULL,
    phone              text,
    full_name          text,
    role               account_role_enum NOT NULL,
    password_hash      text, -- null if using Firebase
    is_email_verified  boolean DEFAULT false,
    is_active          boolean DEFAULT true,
    last_login_at      timestamptz,
    created_at         timestamptz DEFAULT now(),
    updated_at         timestamptz DEFAULT now(),
    CONSTRAINT valid_phone CHECK (phone ~ '^\+?[1-9]\d{1,14}$'), -- E.164 phone format
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);
CREATE INDEX idx_accounts_role ON accounts(role);
CREATE INDEX idx_accounts_firebase_uid ON accounts(firebase_uid);

CREATE TABLE staff_roles (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    description text
);

CREATE TABLE staff_role_permissions (
    role_id     int REFERENCES staff_roles ON DELETE CASCADE,
    permission  text NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE account_staff_roles (
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    role_id    int REFERENCES staff_roles ON DELETE CASCADE,
    PRIMARY KEY (account_id, role_id)
);

CREATE TABLE account_groups (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    description text
);

CREATE TABLE account_group_members (
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    group_id   int REFERENCES account_groups ON DELETE CASCADE,
    PRIMARY KEY (account_id, group_id)
);

-- =============== BRANCHES =================
CREATE TABLE branches (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    address     jsonb,
    timezone    text NOT NULL,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
);
CREATE INDEX idx_branches_name ON branches(name);

-- =============== DEVICES =================
CREATE TABLE devices (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id     int REFERENCES branches ON DELETE SET NULL,
    account_id    uuid REFERENCES accounts ON DELETE SET NULL,
    name          text,
    os            text,
    app_version   text,
    push_token    text UNIQUE,
    registered_at timestamptz DEFAULT now(),
    last_seen_at  timestamptz,
    config        jsonb,
    CONSTRAINT valid_os CHECK (os IN ('iOS', 'Android', 'Windows', 'Linux', 'Other'))
);
CREATE INDEX idx_devices_account_id ON devices(account_id);
CREATE INDEX idx_devices_push_token ON devices(push_token);

-- =============== WAREHOUSE MASTER =================
CREATE TABLE warehouse_operators (
    id          serial PRIMARY KEY,
    name        text UNIQUE NOT NULL,
    website     text,
    api_docs    text
);

CREATE TABLE warehouses (
    id              serial PRIMARY KEY,
    operator_id     int REFERENCES warehouse_operators ON DELETE SET NULL,
    branch_id       int REFERENCES branches ON DELETE SET NULL,
    name            text NOT NULL,
    type            warehouse_type_enum NOT NULL,
    address         jsonb,
    timezone        text NOT NULL,
    api_config      jsonb,
    CONSTRAINT valid_timezone CHECK (timezone ~ '^[A-Za-z]+/[A-Za-z_]+$')
);
CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);

CREATE TABLE warehouse_licenses (
    id                    serial PRIMARY KEY,
    warehouse_id          int REFERENCES warehouses ON DELETE CASCADE,
    license_type          text NOT NULL,
    license_no            text NOT NULL,
    issued_by             text,
    issue_date            date,
    expiry_date           date NOT NULL,
    document_url          text,
    firebase_storage_path text,
    last_notification_at  timestamptz,
    created_at            timestamptz DEFAULT now(),
    renewal_reminder_days int DEFAULT 30,
    CONSTRAINT valid_dates CHECK (issue_date <= expiry_date)
);
CREATE INDEX idx_warehouse_licenses_expiry_date ON warehouse_licenses(expiry_date);

-- =============== PARTNERSHIPS =================
CREATE TABLE partnerships (
    id                  serial PRIMARY KEY,
    operator_id         int REFERENCES warehouse_operators ON DELETE SET NULL,
    name                text NOT NULL,
    api_endpoint        text,
    default_credentials jsonb,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_partnerships_operator_id ON partnerships(operator_id);

-- =============== API CONNECTIONS =================
CREATE TABLE api_connections (
    id                  serial PRIMARY KEY,
    warehouse_id        int REFERENCES warehouses ON DELETE CASCADE,
    customer_id         uuid REFERENCES accounts ON DELETE SET NULL,
    provider            api_provider_enum NOT NULL,
    credentials         jsonb NOT NULL,
    partnership_type    text CHECK (partnership_type IN ('client_provided', 'pre_negotiated')),
    validation_status   text DEFAULT 'pending',
    last_validated_at   timestamptz,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_api_connections_warehouse_id ON api_connections(warehouse_id);
CREATE INDEX idx_api_connections_customer_id ON api_connections(customer_id);

CREATE TABLE event_stream (
    id                  bigserial PRIMARY KEY,
    api_connection_id   int REFERENCES api_connections ON DELETE CASCADE,
    entity_type         text NOT NULL,
    entity_id           text NOT NULL,
    action              text NOT NULL,
    payload             jsonb NOT NULL,
    processed           boolean DEFAULT false,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_event_unprocessed ON event_stream (processed, created_at) WHERE processed = false;
CREATE INDEX idx_event_stream_entity ON event_stream(entity_type, entity_id);

-- =============== MANIFESTS =================
CREATE TABLE manifests (
    id              bigserial PRIMARY KEY,
    warehouse_id    int REFERENCES warehouses ON DELETE SET NULL,
    external_ref    text,
    status          manifest_status_enum DEFAULT 'draft',
    origin          jsonb,
    destination     jsonb,
    flight_no       text,
    eta             timestamptz,
    created_by      uuid REFERENCES accounts ON DELETE SET NULL,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now()
);
CREATE INDEX idx_manifests_status ON manifests(status);
CREATE INDEX idx_manifests_warehouse_id ON manifests(warehouse_id);

CREATE TABLE manifest_items (
    id            bigserial PRIMARY KEY,
    manifest_id   bigint REFERENCES manifests ON DELETE CASCADE,
    sequence_no   int,
    tracking_no   text,
    description   text,
    pieces        int CHECK (pieces > 0),
    weight_kg     numeric CHECK (weight_kg >= 0),
    value_usd     numeric CHECK (value_usd >= 0),
    UNIQUE (manifest_id, tracking_no)
);
CREATE INDEX idx_manifest_items_tracking_no ON manifest_items(tracking_no);

CREATE TABLE manifest_merges (
    parent_manifest_id bigint REFERENCES manifests ON DELETE CASCADE,
    child_manifest_id  bigint REFERENCES manifests ON DELETE CASCADE,
    PRIMARY KEY (parent_manifest_id, child_manifest_id)
);

CREATE TABLE manifest_customs_xml (
    manifest_id bigint PRIMARY KEY REFERENCES manifests ON DELETE CASCADE,
    xml         text NOT NULL,
    created_at  timestamptz DEFAULT now()
);

-- =============== PACKAGES =================
CREATE TABLE packages (
    id                   bigserial PRIMARY KEY,
    tracking_no          text UNIQUE NOT NULL,
    manifest_id          bigint REFERENCES manifests ON DELETE SET NULL,
    customer_id          uuid REFERENCES accounts ON DELETE SET NULL,
    warehouse_id         int REFERENCES warehouses ON DELETE SET NULL,
    status               package_status_enum DEFAULT 'pre_alert',
    weight_kg            numeric CHECK (weight_kg >= 0),
    length_cm            numeric CHECK (length_cm >= 0),
    width_cm             numeric CHECK (width_cm >= 0),
    height_cm            numeric CHECK (height_cm >= 0),
    declared_value_usd   numeric CHECK (declared_value_usd >= 0),
    contents             text,
    current_zone         text,
    is_unknown           boolean DEFAULT false,
    temporary_id         text,
    received_at          timestamptz,
    cleared_at           timestamptz,
    created_at           timestamptz DEFAULT now(),
    updated_at           timestamptz DEFAULT now()
);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_customer_id ON packages(customer_id);
CREATE INDEX idx_packages_tracking_no ON packages(tracking_no);
CREATE INDEX idx_packages_temporary_id ON packages(temporary_id);

CREATE TABLE package_events (
    id          bigserial PRIMARY KEY,
    package_id  bigint REFERENCES packages ON DELETE CASCADE,
    event       text NOT NULL,
    details     jsonb,
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_package_events_package_id ON package_events(package_id);

CREATE TABLE package_contents (
    id          bigserial PRIMARY KEY,
    package_id  bigint REFERENCES packages ON DELETE CASCADE,
    sku         text,
    description text,
    qty         int CHECK (qty > 0),
    value_usd   numeric CHECK (value_usd >= 0)
);

CREATE TABLE package_images (
    id                   bigserial PRIMARY KEY,
    package_id           bigint REFERENCES packages ON DELETE CASCADE,
    url                  text NOT NULL,
    label                text,
    firebase_storage_path text,
    taken_at             timestamptz DEFAULT now()
);

-- =============== PRE-ALERTS =================
CREATE TABLE pre_alerts (
    id            bigserial PRIMARY KEY,
    customer_id   uuid REFERENCES accounts ON DELETE SET NULL,
    tracking_no   text NOT NULL,
    carrier       text,
    sender_name   text,
    sender_addr   jsonb,
    description   text,
    expected_date date,
    status        text DEFAULT 'submitted',
    created_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_pre_alerts_tracking_no ON pre_alerts(tracking_no);

CREATE TABLE pre_alert_attachments (
    id                   bigserial PRIMARY KEY,
    pre_alert_id         bigint REFERENCES pre_alerts ON DELETE CASCADE,
    filename             text,
    url                  text,
    firebase_storage_path text
);

-- =============== TALLY SHEETS =================
CREATE TABLE tally_sheets (
    id            bigserial PRIMARY KEY,
    warehouse_id  int REFERENCES warehouses ON DELETE SET NULL,
    manifest_id   bigint REFERENCES manifests ON DELETE SET NULL,
    created_by    uuid REFERENCES accounts ON DELETE SET NULL,
    status        text DEFAULT 'open',
    created_at    timestamptz DEFAULT now()
);
CREATE INDEX idx_tally_sheets_warehouse_id ON tally_sheets(warehouse_id);

CREATE TABLE tally_sheet_items (
    id               bigserial PRIMARY KEY,
    tally_sheet_id   bigint REFERENCES tally_sheets ON DELETE CASCADE,
    tracking_no      text,
    counted_qty      int CHECK (counted_qty >= 0),
    expected_qty     int CHECK (expected_qty >= 0),
    discrepancy_note text
);
CREATE INDEX idx_tally_sheet_items_tracking_no ON tally_sheet_items(tracking_no);

-- =============== CUSTOMS =================
CREATE TABLE customs_declarations (
    id                bigserial PRIMARY KEY,
    package_id        bigint REFERENCES packages ON DELETE SET NULL,
    declaration_no    text,
    status            text,
    submission_status text DEFAULT 'pending',
    external_ref      text,
    total_duty        numeric CHECK (total_duty >= 0),
    created_at        timestamptz DEFAULT now()
);
CREATE INDEX idx_customs_declarations_package_id ON customs_declarations(package_id);
CREATE INDEX idx_customs_declarations_submission_status ON customs_declarations(submission_status);

CREATE TABLE customs_declaration_items (
    id                 bigserial PRIMARY KEY,
    declaration_id     bigint REFERENCES customs_declarations ON DELETE CASCADE,
    hs_code            text,
    description        text,
    qty                int CHECK (qty > 0),
    value_usd          numeric CHECK (value_usd >= 0),
    duty_rate          numeric CHECK (duty_rate >= 0),
    duty_amount        numeric CHECK (duty_amount >= 0)
);

CREATE TABLE customs_documents (
    id                   bigserial PRIMARY KEY,
    declaration_id       bigint REFERENCES customs_declarations ON DELETE CASCADE,
    doc_type             text,
    file_url             text,
    firebase_storage_path text
);

-- =============== DELIVERIES =================
CREATE TABLE delivery_requests (
    id             bigserial PRIMARY KEY,
    address        jsonb,
    preferred_date date,
    notes          text,
    created_by     uuid REFERENCES accounts ON DELETE SET NULL,
    created_at     timestamptz DEFAULT now()
);

CREATE TABLE delivery_request_packages (
    delivery_request_id bigint REFERENCES delivery_requests ON DELETE CASCADE,
    package_id         bigint REFERENCES packages ON DELETE CASCADE,
    PRIMARY KEY (delivery_request_id, package_id)
);

CREATE TABLE delivery_schedules (
    id            bigserial PRIMARY KEY,
    request_id    bigint REFERENCES delivery_requests ON DELETE CASCADE,
    driver_id     uuid REFERENCES accounts ON DELETE SET NULL,
    vehicle       text,
    scheduled_at  timestamptz,
    status        text DEFAULT 'scheduled'
);
CREATE INDEX idx_delivery_schedules_request_id ON delivery_schedules(request_id);

CREATE TABLE run_sheets (
    id             bigserial PRIMARY KEY,
    driver_id      uuid REFERENCES accounts ON DELETE SET NULL,
    vehicle        text,
    sheet_date     date,
    route_metadata jsonb,
    status         text DEFAULT 'open'
);
CREATE INDEX idx_run_sheets_driver_id ON run_sheets(driver_id);

CREATE TABLE run_sheet_stops (
    id            bigserial PRIMARY KEY,
    run_sheet_id  bigint REFERENCES run_sheets ON DELETE CASCADE,
    schedule_id   bigint REFERENCES delivery_schedules ON DELETE CASCADE,
    sequence      int CHECK (sequence >= 0),
    arrived_at    timestamptz,
    completed_at  timestamptz
);

CREATE TABLE delivery_attempts (
    id                   bigserial PRIMARY KEY,
    schedule_id          bigint REFERENCES delivery_schedules ON DELETE CASCADE,
    attempt_no           int CHECK (attempt_no > 0),
    result               delivery_result_enum,
    note                 text,
    gps                  point,
    image_url            text,
    firebase_storage_path text,
    created_at           timestamptz DEFAULT now()
);
CREATE INDEX idx_delivery_attempts_schedule_id ON delivery_attempts(schedule_id);

CREATE TABLE driver_gps_logs (
    id          bigserial PRIMARY KEY,
    driver_id   uuid REFERENCES accounts ON DELETE SET NULL,
    location    point,
    recorded_at timestamptz DEFAULT now()
);
CREATE INDEX idx_driver_gps_location ON driver_gps_logs USING GIST (location);
CREATE INDEX idx_driver_gps_driver_id ON driver_gps_logs(driver_id);

-- =============== FINANCIAL =================
CREATE TABLE rate_groups (
    id   serial PRIMARY KEY,
    name text UNIQUE NOT NULL
);

CREATE TABLE rate_cards (
    id            bigserial PRIMARY KEY,
    rate_group_id int REFERENCES rate_groups ON DELETE CASCADE,
    weight_start  numeric CHECK (weight_start >= 0),
    weight_end    numeric CHECK (weight_end >= weight_start),
    zone          text,
    price         numeric CHECK (price >= 0)
);

CREATE TABLE rate_overrides (
    id          bigserial PRIMARY KEY,
    customer_id uuid REFERENCES accounts ON DELETE SET NULL,
    package_id  bigint REFERENCES packages ON DELETE SET NULL,
    reason      text,
    price       numeric CHECK (price >= 0),
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE invoices (
    id                   bigserial PRIMARY KEY,
    customer_id          uuid REFERENCES accounts ON DELETE SET NULL,
    invoice_no           text UNIQUE NOT NULL,
    amount_due           numeric CHECK (amount_due >= 0),
    amount_paid          numeric DEFAULT 0 CHECK (amount_paid >= 0),
    status               text DEFAULT 'open',
    pdf_url              text,
    firebase_storage_path text,
    due_date             date,
    created_at           timestamptz DEFAULT now()
);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TABLE invoice_line_items (
    id            bigserial PRIMARY KEY,
    invoice_id    bigint REFERENCES invoices ON DELETE CASCADE,
    description   text,
    package_id    bigint REFERENCES packages ON DELETE SET NULL,
    qty           numeric CHECK (qty > 0),
    unit_price    numeric CHECK (unit_price >= 0),
    line_total    numeric CHECK (line_total >= 0)
);

CREATE TABLE payments (
    id              bigserial PRIMARY KEY,
    invoice_id      bigint REFERENCES invoices ON DELETE CASCADE,
    external_txn_id text,
    amount          numeric CHECK (amount > 0),
    method          text,
    status          text DEFAULT 'pending',
    callback_url    text,
    paid_at         timestamptz DEFAULT now()
);
CREATE INDEX idx_payments_invoice_id ON payments(invoice_id);

CREATE TABLE payment_attempts (
    id            bigserial PRIMARY KEY,
    payment_id    bigint REFERENCES payments ON DELETE CASCADE,
    attempt_no    int CHECK (attempt_no > 0),
    status        text,
    error         text,
    attempted_at  timestamptz DEFAULT now()
);

CREATE TABLE credit_account_limits (
    customer_id uuid PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,
    limit_usd   numeric CHECK (limit_usd >= 0),
    updated_at  timestamptz DEFAULT now()
);

CREATE TABLE expenses (
    id                   bigserial PRIMARY KEY,
    category            expense_category_enum,
    amount              numeric CHECK (amount >= 0),
    note                text,
    file_url            text,
    firebase_storage_path text,
    created_by          uuid REFERENCES accounts ON DELETE SET NULL,
    created_at          timestamptz DEFAULT now()
);

CREATE TABLE petty_cash_entries (
    id          bigserial PRIMARY KEY,
    amount      numeric CHECK (amount != 0),
    type        text CHECK (type IN ('expense', 'reimbursement')),
    note        text,
    approver_id uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

-- =============== STORAGE FEES =================
CREATE TABLE storage_fee_charges (
    id           bigserial PRIMARY KEY,
    package_id   bigint REFERENCES packages ON DELETE CASCADE,
    days_over    int CHECK (days_over >= 0),
    fee_usd      numeric CHECK (fee_usd >= 0),
    invoice_id   bigint REFERENCES invoices ON DELETE SET NULL
);
CREATE INDEX idx_storage_fee_charges_package_id ON storage_fee_charges(package_id);

-- =============== COMMUNICATIONS =================
CREATE TABLE message_templates (
    id      serial PRIMARY KEY,
    name    text UNIQUE NOT NULL,
    subject text,
    body    text
);

CREATE TABLE message_batches (
    id          bigserial PRIMARY KEY,
    template_id int REFERENCES message_templates ON DELETE SET NULL,
    created_by  uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE message_recipient (
    batch_id   bigint REFERENCES message_batches ON DELETE CASCADE,
    account_id uuid REFERENCES accounts ON DELETE CASCADE,
    status     text DEFAULT 'pending',
    PRIMARY KEY (batch_id, account_id)
);

CREATE TABLE notifications (
    id          bigserial PRIMARY KEY,
    account_id  uuid REFERENCES accounts ON DELETE SET NULL,
    channel     notification_channel_enum,
    title       text,
    body        text,
    data        jsonb,
    read_at     timestamptz,
    created_at  timestamptz DEFAULT now()
);
CREATE INDEX idx_notifications_account_id ON notifications(account_id);

CREATE TABLE notification_preferences (
    account_id  uuid REFERENCES accounts ON DELETE CASCADE,
    event_type  text NOT NULL,
    channel     notification_channel_enum NOT NULL,
    enabled     boolean DEFAULT true,
    PRIMARY KEY (account_id, event_type, channel)
);

CREATE TABLE chat_rooms (
    id          bigserial PRIMARY KEY,
    customer_id uuid REFERENCES accounts ON DELETE SET NULL,
    staff_id    uuid REFERENCES accounts ON DELETE SET NULL,
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE chat_messages (
    id                  bigserial PRIMARY KEY,
    room_id             bigint REFERENCES chat_rooms ON DELETE CASCADE,
    sender_id           uuid REFERENCES accounts ON DELETE SET NULL,
    message             text,
    firebase_message_id text,
    created_at          timestamptz DEFAULT now()
);
CREATE INDEX idx_chat_messages_room_id ON chat_messages(room_id);

-- =============== FIREBASE SYNC =================
CREATE TABLE firebase_sync_log (
    id             bigserial PRIMARY KEY,
    entity_type    text NOT NULL,
    entity_id      text NOT NULL,
    firebase_path  text NOT NULL,
    postgres_table text NOT NULL,
    postgres_id    bigint NOT NULL,
    sync_status    text DEFAULT 'pending',
    last_synced_at timestamptz,
    created_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_firebase_sync_log_entity ON firebase_sync_log(entity_type, entity_id);

-- =============== QUICKBOOKS SYNC =================
CREATE TABLE quickbooks_sync (
    id             bigserial PRIMARY KEY,
    entity_type    text NOT NULL,
    entity_id      bigint NOT NULL,
    quickbooks_id  text,
    sync_status    text DEFAULT 'pending',
    last_synced_at timestamptz
);
CREATE INDEX idx_quickbooks_sync_entity ON quickbooks_sync(entity_type, entity_id);

-- =============== SYSTEM CONFIG =================
CREATE TABLE system_config (
    id          serial PRIMARY KEY,
    key         text UNIQUE NOT NULL,
    value       jsonb,
    updated_at  timestamptz DEFAULT now()
);

-- =============== AUDIT & SYSTEM =================
CREATE TABLE audit_logs (
    id         bigserial PRIMARY KEY,
    actor_id   uuid REFERENCES accounts ON DELETE SET NULL,
    entity     text,
    entity_id  text,
    action     text,
    diff       jsonb,
    ts         timestamptz DEFAULT now()
);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);

CREATE TABLE system_events (
    id      bigserial PRIMARY KEY,
    event   text,
    payload jsonb,
    ts      timestamptz DEFAULT now()
);
CREATE INDEX idx_system_events_event ON system_events(event);

-- =============== ROW LEVEL SECURITY =================
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_packages ON packages
    FOR SELECT
    USING (customer_id = current_setting('app.current_user_id')::uuid);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY customer_invoices ON invoices
    FOR SELECT
    USING (customer_id = current_setting('app.current_user_id')::uuid);

-- =============== TRIGGERS FOR EFFICIENCY =================
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_accounts_timestamp
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_packages_timestamp
    BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_invoices_timestamp
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE OR REPLACE FUNCTION validate_jsonb_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.address IS NOT NULL THEN
        IF NOT jsonb_typeof(NEW.address) = 'object' THEN
            RAISE EXCEPTION 'Address must be a JSON object';
        END IF;
        IF NOT NEW.address ? 'street' OR NOT NEW.address ? 'city' OR NOT NEW.address ? 'country' THEN
            RAISE EXCEPTION 'Address must contain street, city, and country';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_warehouse_address
    BEFORE INSERT OR UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION validate_jsonb_address();

CREATE TRIGGER validate_delivery_request_address
    BEFORE INSERT OR UPDATE ON delivery_requests
    FOR EACH ROW EXECUTE FUNCTION validate_jsonb_address();

-- =============== LICENSE EXPIRATION NOTIFICATION FUNCTION =================
CREATE OR REPLACE FUNCTION notify_license_expiration() 
RETURNS void AS $$
BEGIN
  INSERT INTO notifications (account_id, channel, title, body)
  SELECT NULL, 'email', 
         'License Expiring Soon',
         'Warehouse license ' || license_no || ' expires on ' || expiry_date
  FROM warehouse_licenses
  WHERE expiry_date <= CURRENT_DATE + INTERVAL '30 days'
    AND last_notification_at IS NULL;
END;
$$ LANGUAGE plpgsql;

