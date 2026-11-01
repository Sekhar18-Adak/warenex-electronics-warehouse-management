CREATE TABLE purchase_order_items (

    id INT UNSIGNED NOT NULL AUTO_INCREMENT,

    purchase_order_id INT UNSIGNED NOT NULL,

    product_id INT UNSIGNED NOT NULL,

    quantity INT NOT NULL,

    received_quantity INT NOT NULL DEFAULT 0,

    purchase_price DECIMAL(10,2) NOT NULL,

    subtotal DECIMAL(12,2) NOT NULL,

    remarks VARCHAR(255) DEFAULT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_purchase_order (purchase_order_id),

    KEY idx_product (product_id),

    CONSTRAINT fk_purchase_items_order
        FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_purchase_items_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE RESTRICT

) ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;