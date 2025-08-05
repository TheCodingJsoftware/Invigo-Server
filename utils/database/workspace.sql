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
    sheet JSONB,
    laser_cut_parts JSONB,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    modified_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_nest_laser_cut_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    nest_id INTEGER NOT NULL REFERENCES workspace_nests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
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

CREATE TABLE IF NOT EXISTS workspace_assemblies (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
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

CREATE TABLE IF NOT EXISTS workspace_assembly_laser_cut_parts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES workspace_jobs(id) ON DELETE CASCADE,
    assembly_id INTEGER NOT NULL REFERENCES workspace_assemblies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flowtag TEXT [] NOT NULL,
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
CREATE
OR REPLACE FUNCTION notify_job_change() RETURNS trigger AS $$ BEGIN PERFORM pg_notify(
    'workspace_jobs',
    json_build_object(
        'type',
        TG_OP,
        'table',
        TG_TABLE_NAME,
        'job_id',
        COALESCE(NEW.id, OLD.id)
    ) :: text
);

RETURN COALESCE(NEW, OLD);

END;

$$ LANGUAGE plpgsql;

CREATE
OR REPLACE TRIGGER job_event_trigger
AFTER
INSERT
    OR
UPDATE
    OR DELETE ON workspace_jobs FOR EACH ROW EXECUTE FUNCTION notify_job_change();

-- Notification Trigger for laser cut parts
-- Auto-updated grouping view per job
CREATE
OR REPLACE VIEW view_grouped_laser_cut_parts_by_job AS
SELECT
    MIN(id) AS group_id,
    job_id,
    name,
    flowtag,
    flowtag_index,
    flowtag [flowtag_index + 1] AS current_flowtag,
    (flowtag_index + 1 = cardinality(flowtag)) AS is_completed,
    COUNT(*) AS quantity,
    MIN(created_at) AS created_at,
    MAX(modified_at) AS modified_at
FROM
    workspace_assembly_laser_cut_parts w
GROUP BY
    job_id,
    name,
    flowtag,
    flowtag_index;

CREATE
OR REPLACE VIEW view_grouped_laser_cut_parts_global AS
SELECT
    MIN(id) AS group_id,
    name,
    flowtag,
    flowtag_index,
    flowtag [flowtag_index + 1] AS current_flowtag,
    (flowtag_index + 1 = cardinality(flowtag)) AS is_completed,
    COUNT(*) AS quantity,
    MIN(created_at) AS created_at,
    MAX(modified_at) AS modified_at
FROM
    workspace_assembly_laser_cut_parts w
GROUP BY
    name,
    flowtag,
    flowtag_index;

-- Notification function for laser cut parts view changes
CREATE OR REPLACE FUNCTION notify_laser_cut_parts_view_change()
RETURNS trigger AS $$
BEGIN
    -- Notify for the job-specific view
    PERFORM pg_notify(
        'view_grouped_laser_cut_parts_by_job',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'job_id', COALESCE(NEW.job_id, OLD.job_id),
            'part_name', COALESCE(NEW.name, OLD.name),
            'flowtag', COALESCE(NEW.flowtag, OLD.flowtag),
            'flowtag_index', COALESCE(NEW.flowtag_index, OLD.flowtag_index)
        )::text
    );

    -- Notify for the global view
    PERFORM pg_notify(
        'view_grouped_laser_cut_parts_global',
        json_build_object(
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'part_name', COALESCE(NEW.name, OLD.name),
            'flowtag', COALESCE(NEW.flowtag, OLD.flowtag),
            'flowtag_index', COALESCE(NEW.flowtag_index, OLD.flowtag_index)
        )::text
    );

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger on the underlying table
CREATE OR REPLACE TRIGGER laser_cut_parts_view_event_trigger
    AFTER INSERT OR UPDATE OR DELETE
    ON workspace_assembly_laser_cut_parts
    FOR EACH ROW
    EXECUTE FUNCTION notify_laser_cut_parts_view_change();