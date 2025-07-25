-- Base Tables
CREATE TABLE IF NOT EXISTS workspace_jobs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    job_data JSONB,
    assemblies JSONB,
    nests JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_nests (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_assemblies (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
    group_id INTEGER,
    name TEXT NOT NULL,
    flowtag TEXT[] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    setup_time JSONB,
    setup_time_seconds INTEGER,
    process_time JSONB,
    process_time_seconds INTEGER,
    automated_time JSONB,
    automated_time_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_laser_cut_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    laser_cut_part_group_id INTEGER,
    name TEXT NOT NULL,
    flowtag TEXT[] NOT NULL,
    flowtag_index INTEGER NOT NULL DEFAULT 0,
    setup_time JSONB,
    setup_time_seconds INTEGER,
    process_time JSONB,
    process_time_seconds INTEGER,
    automated_time JSONB,
    automated_time_seconds INTEGER,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    inventory_data JSONB,
    meta_data JSONB,
    prices JSONB,
    paint_data JSONB,
    primer_data JSONB,
    powder_data JSONB,
    workspace_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_components (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    assembly_id INTEGER,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

-- Notification Trigger for workspace_jobs
CREATE OR REPLACE FUNCTION notify_job_change() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'workspace_jobs',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'job_id', COALESCE(NEW.id, OLD.id)
        )::text
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER job_event_trigger
AFTER INSERT OR UPDATE OR DELETE ON workspace_jobs
FOR EACH ROW EXECUTE FUNCTION notify_job_change();

-- Notification Trigger for laser cut parts
CREATE OR REPLACE FUNCTION notify_laser_cut_parts_change() RETURNS trigger AS $$
DECLARE
    delta jsonb := '{}'::jsonb;
    key text;
    _job_id int := COALESCE(NEW.job_id, OLD.job_id);
    _id int := COALESCE(NEW.id, OLD.id);
BEGIN
    IF TG_OP = 'UPDATE' THEN
        FOR key IN SELECT jsonb_object_keys(to_jsonb(NEW)) LOOP
            IF to_jsonb(NEW)->key IS DISTINCT FROM to_jsonb(OLD)->key THEN
                delta := delta || jsonb_build_object(key, to_jsonb(NEW)->key);
            END IF;
        END LOOP;
    ELSE
        delta := to_jsonb(COALESCE(NEW, OLD));
    END IF;

    PERFORM pg_notify(
        'workspace_laser_cut_parts',
        json_build_object(
            'type', TG_OP,
            'id', _id,
            'job_id', _job_id,
            'delta', delta
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER notify_laser_cut_parts_trigger
AFTER INSERT OR UPDATE OR DELETE ON workspace_laser_cut_parts
FOR EACH ROW EXECUTE FUNCTION notify_laser_cut_parts_change();

-- Auto-updated grouping view per job
CREATE OR REPLACE VIEW view_grouped_laser_cut_parts_by_job AS
SELECT
    MIN(id) AS group_id,
    job_id,
    name,
    flowtag,
    flowtag_index,
    COUNT(*) AS quantity,
    jsonb_agg(inventory_data) AS inventory_data,
    jsonb_agg(meta_data) AS meta_data,
    jsonb_agg(prices) AS prices,
    jsonb_agg(paint_data) AS paint_data,
    jsonb_agg(primer_data) AS primer_data,
    jsonb_agg(powder_data) AS powder_data,
    jsonb_agg(workspace_data) AS workspace_data,
    MIN(created_at) AS created_at,
    MAX(modified_at) AS modified_at
FROM workspace_laser_cut_parts
GROUP BY job_id, name, flowtag, flowtag_index;

-- Auto-updated grouping view across all jobs
CREATE OR REPLACE VIEW view_grouped_laser_cut_parts_global AS
SELECT
    MIN(id) AS group_id,
    name,
    flowtag,
    flowtag_index,
    COUNT(*) AS quantity,
    jsonb_agg(inventory_data) AS inventory_data,
    jsonb_agg(meta_data) AS meta_data,
    jsonb_agg(prices) AS prices,
    jsonb_agg(paint_data) AS paint_data,
    jsonb_agg(primer_data) AS primer_data,
    jsonb_agg(powder_data) AS powder_data,
    jsonb_agg(workspace_data) AS workspace_data,
    MIN(created_at) AS created_at,
    MAX(modified_at) AS modified_at
FROM workspace_laser_cut_parts
GROUP BY name, flowtag, flowtag_index;
