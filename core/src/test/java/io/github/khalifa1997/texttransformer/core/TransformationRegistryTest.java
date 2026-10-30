package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

import org.junit.jupiter.api.Test;

class TransformationRegistryTest {

    private final TransformationRegistry registry = TransformationRegistry.builtIn();

    @Test
    void listsTheBuiltInTransformationsInPaletteOrder() {
        assertThat(registry.all())
                .extracting(Transformation::id, Transformation::label, Transformation::description)
                .containsExactly(
                        tuple("uppercase", "Uppercase", "Converts the text to upper case."),
                        tuple("lowercase", "Lowercase", "Converts the text to lower case."));
    }

    @Test
    void findsATransformationById() {
        assertThat(registry.find("lowercase")).map(Transformation::label).contains("Lowercase");
    }

    @Test
    void findsNothingForAnUnknownId() {
        assertThat(registry.find("titlecase")).isEmpty();
    }

    @Test
    void builtInIdsAreUniqueAndLowercase() {
        assertThat(registry.all())
                .extracting(Transformation::id)
                .doesNotHaveDuplicates()
                .allSatisfy(id -> assertThat(id).matches("[a-z]+"));
    }
}
