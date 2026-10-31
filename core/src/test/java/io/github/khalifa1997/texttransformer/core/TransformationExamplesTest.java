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
                Arguments.of("reverse", "Hello", values(), "olleH"),
                Arguments.of("reverse", "", values(), ""),
                // Characters as a reader sees them: an emoji keeps its surrogate pair,
                Arguments.of("reverse", "\uD83D\uDE00ab", values(), "ba\uD83D\uDE00"),
                // a combining accent stays on its letter,
                Arguments.of("reverse", "e\u0301a", values(), "ae\u0301"),
                // a flag stays the same flag,
                Arguments.of("reverse", "\uD83C\uDDE9\uD83C\uDDEA\uD83C\uDDEB\uD83C\uDDF7", values(),
                        "\uD83C\uDDEB\uD83C\uDDF7\uD83C\uDDE9\uD83C\uDDEA"),
                // a joined emoji stays joined,
                Arguments.of("reverse", "\uD83D\uDC68\u200D\uD83D\uDC67x", values(), "x\uD83D\uDC68\u200D\uD83D\uDC67"),
                // and a Windows line break stays \r\n.
                Arguments.of("reverse", "a\r\nb", values(), "b\r\na"),
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
                Arguments.of("prepend", "World", values(), "World"),
                Arguments.of("substring", "Hello", values("start", 2, "end", 99), "llo"),
                Arguments.of("substring", "Hello", values("start", 10, "end", 20), ""),
                Arguments.of("substring", "Hello", values("start", 1), "ello"),
                Arguments.of("substring", "Hello", values("start", 1, "end", null), "ello"),
                Arguments.of("substring", "Hello", values("start", 1, "end", 1), ""),
                // Code points, not UTF-16 units.
                Arguments.of("substring", "\uD83D\uDE00ab", values("start", 0, "end", 1), "\uD83D\uDE00"),
                Arguments.of("substring", "\uD83D\uDE00ab", values("start", 1), "ab"),
                Arguments.of("regex", "2026-10-25",
                        values("pattern", "(\\d+)-(\\d+)-(\\d+)", "replacement", "$3/$2/$1"), "25/10/2026"),
                // Java's Matcher.appendReplacement rules: \ escapes the next character.
                Arguments.of("regex", "5 apples", values("pattern", "\\d+", "replacement", "\\$$0"), "$5 apples"),
                Arguments.of("regex", "abc", values("pattern", "b", "replacement", "\\n\\\\\\$1"), "an\\$1c"),
                // $0 is the whole match.
                Arguments.of("regex", "cat", values("pattern", "(c)at", "replacement", "[$0]"), "[cat]"),
                // Digits after the first join the group number only while that group exists.
                Arguments.of("regex", "cat", values("pattern", "(c)at", "replacement", "$10"), "c0"),
                Arguments.of("regex", "john smith",
                        values("pattern", "(?<first>\\w+) (?<last>\\w+)", "replacement", "${last}, ${first}"),
                        "smith, john"),
                // A group that did not take part is empty.
                Arguments.of("regex", "abc", values("pattern", "(x)?b", "replacement", "<$1>"), "a<>c"),
                Arguments.of("regex", "aaa", values("pattern", "a", "replacement", "b"), "bbb"),
                Arguments.of("regex", "abc", values("pattern", "x", "replacement", "y"), "abc"),
                Arguments.of("regex", "Abc", values("pattern", "a", "replacement", "x"), "Abc"),
                Arguments.of("regex", "Abc", values("pattern", "a", "replacement", "x", "ignoreCase", true), "xbc"),
                Arguments.of("regex", "a\nb", values("pattern", "(?m)^b", "replacement", "x"), "a\nx"),
                Arguments.of("regex", "abc", values("pattern", "b"), "ac"),
                Arguments.of("trim", " \t Hi there \n", values(), "Hi there"),
                Arguments.of("trim", " \t Hi there \n", values("sides", "start"), "Hi there \n"),
                Arguments.of("trim", " \t Hi there \n", values("sides", "end"), " \t Hi there"),
                // Unicode whitespace too, such as the ideographic space.
                Arguments.of("trim", "\u3000Hi\u3000", values(), "Hi"),
                Arguments.of("trim", "   ", values(), ""),
                Arguments.of("mask", "secret", values(), "******"),
                Arguments.of("mask", "4111111111111111", values("keepEnd", 4), "************1111"),
                Arguments.of("mask", "john@example.com", values("character", "#", "keepStart", 1, "keepEnd", 4),
                        "j###########.com"),
                // Keeping more than there is masks nothing.
                Arguments.of("mask", "abc", values("keepStart", 2, "keepEnd", 2), "abc"),
                Arguments.of("mask", "", values(), ""),
                // Code points: an emoji is one character, in the text and as the mask.
                Arguments.of("mask", "\uD83D\uDE00ab", values("keepEnd", 1), "**b"),
                Arguments.of("mask", "ab", values("character", "\uD83D\uDE48"), "\uD83D\uDE48\uD83D\uDE48"),
                Arguments.of("base64encode", "Hello", values(), "SGVsbG8="),
                Arguments.of("base64encode", "", values(), ""),
                // UTF-8 bytes.
                Arguments.of("base64encode", "straße", values(), "c3RyYcOfZQ=="),
                Arguments.of("base64encode", "??>", values(), "Pz8+"),
                Arguments.of("base64encode", "??>", values("urlSafe", true), "Pz8-"),
                Arguments.of("base64decode", "SGVsbG8=", values(), "Hello"),
                Arguments.of("base64decode", "c3RyYcOfZQ==", values(), "straße"),
                // Padding is optional and whitespace, such as line wrapping, is ignored.
                Arguments.of("base64decode", "SGVsbG8", values(), "Hello"),
                Arguments.of("base64decode", " SGVs\nbG8= ", values(), "Hello"),
                Arguments.of("base64decode", "Pz8-", values("urlSafe", true), "??>"),
                Arguments.of("base64decode", "", values(), ""));
    }

    @ParameterizedTest(name = "{0}: \"{1}\" {2} -> \"{3}\"")
    @MethodSource("examples")
    void appliesTheWorkedExample(String id, String input, Map<String, Object> values, String expected) {
        Transformation transformation = registry.find(id).orElseThrow();

        var fieldValues = FieldValues.of(transformation.fields(), values);

        assertThat(transformation.apply(input, fieldValues)).isEqualTo(expected);
    }
}
