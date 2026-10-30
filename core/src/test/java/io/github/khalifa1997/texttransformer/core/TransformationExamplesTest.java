package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** One row per worked example in the Transformations table. */
class TransformationExamplesTest {

    private final TransformationRegistry registry = TransformationRegistry.builtIn();

    @ParameterizedTest(name = "{0}: \"{1}\" -> \"{2}\"")
    @CsvSource({
        "uppercase, straße, STRASSE",
        "uppercase, title, TITLE",
        "lowercase, TITLE, title",
        // Locale.ROOT: a capital I lowercases to a dotted i on every server.
        "lowercase, TITLE IN ISTANBUL, title in istanbul",
    })
    void appliesTheWorkedExample(String id, String input, String expected) {
        Transformation transformation = registry.find(id).orElseThrow();

        assertThat(transformation.apply(input)).isEqualTo(expected);
    }
}
