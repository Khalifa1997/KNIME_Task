package io.github.khalifa1997.texttransformer.app;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.assertj.MockMvcTester;

@SpringBootTest
@AutoConfigureMockMvc
class TransformationsApiTest {

    @Autowired
    private MockMvcTester mvc;

    @Test
    void listsTheLimitsAndEveryTransformationAsInTheContract() {
        assertThat(mvc.get().uri("/api/transformations"))
                .hasStatusOk()
                .hasContentTypeCompatibleWith(MediaType.APPLICATION_JSON)
                .bodyJson()
                .isStrictlyEqualTo(new ClassPathResource("contract/get-transformations.200.json"));
    }
}
