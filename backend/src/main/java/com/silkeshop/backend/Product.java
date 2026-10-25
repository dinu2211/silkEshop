package com.silkeshop.backend;

public record Product(
        String id,
        String name,
        String description,
        int price,
        String imageUrl,
        String category) {
}
