CREATE TABLE sales_history (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    product_id VARCHAR(50) NOT NULL,

    customer_id VARCHAR(20) DEFAULT NULL,

    quantity INT NOT NULL,

    unit_price DECIMAL(10,2) NOT NULL,

    total_amount DECIMAL(12,2) NOT NULL,

    payment_status VARCHAR(20) NOT NULL DEFAULT 'Pending',

    sold_by INT UNSIGNED NOT NULL,

    selling_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_product (product_id),
    KEY idx_customer (customer_id),
    KEY idx_payment_status (payment_status),

    CONSTRAINT chk_sales_payment_status
        CHECK (
            payment_status IN (
                'Pending',
                'Paid',
                'Partially Paid'
            )
        ),

    CONSTRAINT fk_sales_product
        FOREIGN KEY (product_id)
        REFERENCES products(product_code)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sales_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(customer_code)
        ON DELETE SET NULL,

    CONSTRAINT fk_sales_user
        FOREIGN KEY (sold_by)
        REFERENCES users(id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;