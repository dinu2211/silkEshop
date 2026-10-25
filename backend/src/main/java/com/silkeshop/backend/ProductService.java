package com.silkeshop.backend;

import java.util.List;

import org.springframework.stereotype.Service;

@Service
public class ProductService {

    private final List<Product> products = List.of(
            new Product("silk-dhoti-01", "Kanchipuram Silk Dhoti - Gold Zari Border",
                    "Traditional cream silk dhoti with an elegant gold zari border.", 3499,
                    "assets/images/silk-dhoti-01.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-02", "Pure Silk Dhoti - Maroon Border",
                    "Classic pure silk dhoti finished with a rich maroon border.", 3299,
                    "assets/images/silk-dhoti-02.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-03", "Wedding Silk Dhoti - Wide Zari",
                    "Ceremonial silk dhoti featuring a wide traditional zari border.", 3999,
                    "assets/images/silk-dhoti-03.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-04", "Soft Silk Dhoti - Green Border",
                    "Lightweight soft silk dhoti with a contrasting green border.", 2899,
                    "assets/images/silk-dhoti-04.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-05", "Temple Border Silk Dhoti",
                    "Cream silk dhoti with a detailed temple-inspired zari border.", 3699,
                    "assets/images/silk-dhoti-05.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-06", "Mysore Silk Dhoti - Gold Edge",
                    "Smooth Mysore-style silk dhoti with a subtle gold edge.", 3199,
                    "assets/images/silk-dhoti-06.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-07", "Silk Dhoti - Royal Blue Border",
                    "Traditional silk dhoti with a striking royal blue border.", 3399,
                    "assets/images/silk-dhoti-07.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-08", "Silk Dhoti - Red Zari Border",
                    "Festive cream silk dhoti trimmed with a red zari border.", 3599,
                    "assets/images/silk-dhoti-08.jpeg", "Silk Dhoti"),
            new Product("silk-dhoti-09", "Lightweight Silk Dhoti - Beige Border",
                    "Comfortable lightweight silk dhoti with a refined beige border.", 2799,
                    "assets/images/silk-dhoti-09.jpeg", "Silk Material Combo"),
            new Product("silk-dhoti-10", "Silk Dhoti - Double Zari Border",
                    "Ceremonial silk dhoti with a distinctive double zari border.", 3799,
                    "assets/images/silk-dhoti-10.jpeg", "Silk Dhoti Set"),
            new Product("silk-dhoti-11", "Traditional Silk Dhoti - Purple Border",
                    "Classic silk dhoti with a rich purple contrast border.", 3299,
                    "assets/images/silk-dhoti-11.jpeg", "Silk Dhoti Set"),
            new Product("silk-dhoti-12", "Silk Dhoti - Checked Zari Border",
                    "Textured silk dhoti with a checked gold zari border.", 3499,
                    "assets/images/silk-dhoti-12.jpeg", "Silk Dhoti Set"),
            new Product("silk-dhoti-13", "Premium Silk Dhoti - Grand Border",
                    "Premium silk dhoti designed with a broad grand zari border.", 4299,
                    "assets/images/silk-dhoti-13.jpeg", "Silk Dhoti Set"),
            new Product("silk-dhoti-14", "Silk Dhoti - Orange Contrast Border",
                    "Festive silk dhoti with a bright orange contrast border.", 3099,
                    "assets/images/silk-dhoti-14.jpeg", "Silk Dhoti Set"),
            new Product("silk-dhoti-15", "Silk Dhoti - Classic Gold Border",
                    "Versatile cream silk dhoti with a timeless gold border.", 2999,
                    "assets/images/silk-dhoti-15.jpeg", "Silk Dhoti Set"),
            new Product("plain-dhoti-01", "Cotton Dhoti - White with Gold Border",
                    "Breathable white cotton dhoti with a simple gold-tone border.", 799,
                    "assets/images/silk-dhoti-16.jpeg", "Silk Dhoti Set"),
            new Product("plain-dhoti-02", "Cotton Dhoti - White with Green Border",
                    "Everyday white cotton dhoti finished with a green border.", 749,
                    "assets/images/silk-dhoti-17.jpeg", "Silk Dhoti Set"),
            new Product("plain-dhoti-03", "Traditional White Cotton Dhoti",
                    "Soft, breathable white cotton dhoti for daily traditional wear.", 699,
                    "assets/images/silk-dhoti-18.jpeg", "Silk Dhoti Set"),
            new Product("plain-dhoti-04", "Cotton Dhoti - Maroon Border",
                    "Classic white cotton dhoti with a contrasting maroon border.", 799,
                    "assets/images/silk-dhoti-19.jpeg", "Silk Dhoti Set"));

    public List<Product> getProducts() {
        return products;
    }
}
