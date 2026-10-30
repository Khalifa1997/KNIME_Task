package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

/** One row per worked example in the Transformations table. */
class TransformationExamplesTest {

    private final TransformationRegistry registry = TransformationRegistry.builtIn();

    private static Map<String, Object> values(Object... namesAndValues) {
        var values = new HashMap<String, Object>();
        for (int i = 0; i < namesAndValues.length; i += 2) {
            values.put((String) namesAndValues[i], namesAndValues[i + 1]);
        }
        return values;
    }

    static Stream<Arguments> examples() {
        return Stream.of(
                Arguments.of("uppercase", "straße", values(), "STRASSE"),
                Arguments.of("uppercase", "title", values(), "TITLE"),
                Arguments.of("lowercase", "TITLE", values(), "title"),
                // Locale.ROOT: a capital I lowercases to a dotted i on every server.
                Arguments.of("lowercase", "TITLE IN ISTANBUL", values(), "title in istanbul"),
                Arguments.of("replace", "a-b-a", values("search", "a", "replacement", "x"), "x-b-x"),
                // Case-sensitive.
                Arguments.of("replace", "Aa", values("search", "a", "replacement", "x"), "Ax"),
                // Literal, not a regex.
                Arguments.of("replace", "a.c abc", values("search", ".", "replacement", "!"), "a!c abc"),
                // An empty replacement deletes the match.
                Arguments.of("replace", "a-b-a", values("search", "a", "replacement", ""), "-b-"),
                // A missing or null replacement takes its default, the empty text.
                Arguments.of("replace", "a-b-a", values("search", "a"), "-b-"),
                Arguments.of("replace", "a-b-a", values("search", "a", "replacement", null), "-b-"),
                // Never trimmed.
                Arguments.of("replace", "a b", values("search", " ", "replacement", "  "), "a  b"),
                // Unknown Field names are ignored.
                Arguments.of("replace", "a", values("search", "a", "replacement", "x", "gone", 1), "x"),
                Arguments.of("append", "Hi", values("text", " !"), "Hi !"),
                Arguments.of("append", "Hi", values("text", ""), "Hi"),
                Arguments.of("append", "Hi", values("text", null), "Hi"),
                Arguments.of("append", "Hi", values(), "Hi"),
                Arguments.of("prepend", "World", values("text", "Hello "), "Hello World"),
                Arguments.of("prepend", "World", values("text", ""), "World"),
                Arguments.of("prepend", "World", values(), "World"));
    }

    @ParameterizedTest(name = "{0}: \"{1}\" {2} -> \"{3}\"")
    @MethodSource("examples")
    void appliesTheWorkedExample(String id, String input, Map<String, Object> values, String expected) {
        Transformation transformation = registry.find(id).orElseThrow();

        var fieldValues = FieldValues.of(transformation.fields(), values);

        assertThat(transformation.apply(input, fieldValues)).isEqualTo(expected);
    }
}
