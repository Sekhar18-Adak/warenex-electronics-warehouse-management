CREATE TABLE tasks (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    task_code VARCHAR(30) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,

    assigned_by INT UNSIGNED NOT NULL,
    assigned_to INT UNSIGNED NOT NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',

    start_date DATE NOT NULL,
    due_date DATE NOT NULL,

    product_id INT UNSIGNED DEFAULT NULL,
    additional_notes TEXT DEFAULT NULL,

    completed_at TIMESTAMP NULL DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_task_code (task_code),
    KEY idx_task_assigned_by (assigned_by),
    KEY idx_task_assigned_to (assigned_to),
    KEY idx_task_status (status),
    KEY idx_task_due_date (due_date),

    CONSTRAINT chk_task_priority
        CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),

    CONSTRAINT chk_task_status
        CHECK (status IN (
            'Pending',
            'In Progress',
            'Completed',
            'Cancelled'
        )),

    CONSTRAINT fk_task_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_task_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_task_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL
);