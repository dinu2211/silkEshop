package com.silkeshop.backend;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ProductsControllerTests {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void returnsProductsFromTheCatalog() throws Exception {
        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(19))
                .andExpect(jsonPath("$[0].id").value("silk-dhoti-01"))
                .andExpect(jsonPath("$[0].name").value("Kanchipuram Silk Dhoti - Gold Zari Border"))
                .andExpect(jsonPath("$[0].description")
                        .value("Traditional cream silk dhoti with an elegant gold zari border."))
                .andExpect(jsonPath("$[0].price").value(3499))
                .andExpect(jsonPath("$[0].imageUrl").value("assets/images/silk-dhoti-01.jpeg"))
                .andExpect(jsonPath("$[0].category").value("Silk Dhoti"));
    }
}
