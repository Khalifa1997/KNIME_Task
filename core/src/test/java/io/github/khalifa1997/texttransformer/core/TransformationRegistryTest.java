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
                        tuple("replace", "Replace", "Replaces every occurrence of some text with other text."),
                        tuple("append", "Append", "Adds text to the end."),
                        tuple("prepend", "Prepend", "Adds text to the start."),
                        tuple("uppercase", "Uppercase", "Converts the text to upper case."),
                        tuple("lowercase", "Lowercase", "Converts the text to lower case."));
    }

    @Test
    void declaresTheFieldsOfReplaceAppendAndPrepend() {
        assertThat(registry.all())
                .flatExtracting(t -> t.fields().stream()
                        .map(f -> tuple(t.id(), f.name(), f.label(), f.type(), f.required(), f.defaultValue()))
                        .toList())
                .containsExactly(
                        tuple("replace", "search", "Search", FieldSpec.Type.TEXT, true, null),
                        tuple("replace", "replacement", "Replacement", FieldSpec.Type.TEXT, false, ""),
                        tuple("append", "text", "Text", FieldSpec.Type.TEXT, false, ""),
                        tuple("prepend", "text", "Text", FieldSpec.Type.TEXT, false, ""));
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

    @Test
    void everyDefaultValuePassesItsOwnFieldSpec() {
        assertThat(registry.all())
                .flatExtracting(Transformation::fields)
                .allSatisfy(field -> assertThat(passes(field, field.defaultValue()))
                        .as("%s default %s", field.name(), field.defaultValue())
                        .isTrue());
    }

    private static boolean passes(FieldSpec field, Object value) {
        // No default is fine: a required Field has none, and an optional one then takes null.
        if (value == null) {
            return true;
        }
        return switch (field.type()) {
            case TEXT -> value instanceof String;
            case BOOLEAN -> value instanceof Boolean;
            case INTEGER -> value instanceof Integer n
                    && (field.min() == null || n >= field.min())
                    && (field.max() == null || n <= field.max());
            case SELECT -> field.options().stream().anyMatch(choice -> choice.value().equals(value));
        };
    }
}
