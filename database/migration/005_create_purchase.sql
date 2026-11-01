CREATE TABLE purchase_orders (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    purchase_order_no VARCHAR(30) NOT NULL,

    supplier_id INT UNSIGNED NOT NULL,

    order_date DATE NOT NULL,

    expected_delivery DATE DEFAULT NULL,

    actual_delivery DATE DEFAULT NULL,

    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',

    order_status VARCHAR(20) NOT NULL DEFAULT 'Pending',

    notes TEXT DEFAULT NULL,

    created_by INT UNSIGNED NOT NULL,

    approved_by INT UNSIGNED DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uk_purchase_order_no (purchase_order_no),

    KEY idx_supplier (supplier_id),
    KEY idx_order_status (order_status),
    KEY idx_payment_status (payment_status),
    KEY idx_created_by (created_by),

    CONSTRAINT chk_order_status
        CHECK (
            order_status IN (
                'Pending',
                'Approved',
                'Partially Received',
                'Completed',
                'Cancelled'
            )
        ),

    CONSTRAINT chk_payment_status
        CHECK (
            payment_status IN (
                'Pending',
                'Partially Paid',
                'Paid'
            )
        ),

    CONSTRAINT fk_purchase_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_purchase_created_by
        FOREIGN KEY (created_by)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_purchase_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;