package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

/** The rules only Substring and Regex replace have, seen through the runner. */
class SubstringAndRegexRulesTest {

    private final ChainRunner runner = new ChainRunner(TransformationRegistry.builtIn());

    private RunResult run(String input, String id, Map<String, Object> values) {
        return runner.run(input, List.of(new StepInput(id, values)));
    }

    private static RunResult.Rejected rejected(String field, ErrorCode errorCode, String message) {
        return new RunResult.Rejected(List.of(new StepError(0, field, errorCode, message)));
    }

    @Test
    void substringRejectsStartAfterEndOnEnd() {
        assertThat(run("Hello", "substring", Map.of("start", 3, "end", 2)))
                .isEqualTo(rejected("end", ErrorCode.START_AFTER_END, "End must not be before Start."));
    }

    @Test
    void substringAllowsStartEqualToEndAndSkipsTheCheckWithoutEnd() {
        assertThat(run("Hello", "substring", Map.of("start", 3, "end", 3)))
                .isEqualTo(new RunResult.Completed("", List.of("")));
        assertThat(run("Hello", "substring", Map.of("start", 30)))
                .isEqualTo(new RunResult.Completed("", List.of("")));
    }

    @Test
    void substringRejectsNegativeStartAndEnd() {
        assertThat(run("Hello", "substring", Map.of("start", -1)))
                .isEqualTo(rejected("start", ErrorCode.BELOW_MIN, "Start must be 0 or more."));
        assertThat(run("Hello", "substring", Map.of("start", 0, "end", -1)))
                .isEqualTo(rejected("end", ErrorCode.BELOW_MIN, "End must be 0 or more."));
    }

    @Test
    void regexRejectsAnInvalidPatternWithTheJavaDescription() {
        var result = run("abc", "regex", Map.of("pattern", "(abc"));

        assertThat(result).isEqualTo(rejected("pattern", ErrorCode.INVALID_PATTERN,
                "Unclosed group"));
    }

    @Test
    void regexRejectsAnEmptyPatternAsRequired() {
        assertThat(run("abc", "regex", Map.of("pattern", "")))
                .isEqualTo(rejected("pattern", ErrorCode.REQUIRED, "Pattern is required."));
    }

    @Test
    void regexStopsTheChainAtTheStepWhenThePatternRunsOverTwoSeconds() {
        var catastrophic = "a".repeat(40) + "!";
        var steps = List.of(
                new StepInput("append", Map.of("text", "")),
                new StepInput("regex", Map.of("pattern", "^(a+)+\\1$")),
                new StepInput("append", Map.of("text", "never")));

        var started = System.nanoTime();
        var result = runner.run(catastrophic, steps);
        var elapsedMillis = (System.nanoTime() - started) / 1_000_000;

        assertThat(result).isEqualTo(new RunResult.Rejected(List.of(
                new StepError(1, null, ErrorCode.PATTERN_TIMEOUT, "Pattern took too long."))));
        assertThat(elapsedMillis).isBetween(1_900L, 5_000L);
    }

    @Test
    void regexStopsBuildingAResultOnceItPassesTheLimit() {
        // A lookahead group captures past the match: ~3,000 empty matches, each 1,500 copies of the rest of the
        // text, is about 13 GB if built.
        var steps = List.of(
                new StepInput("append", Map.of("text", "")),
                new StepInput("regex", Map.of("pattern", "(?=(.*))", "replacement", "$1".repeat(1_500))),
                new StepInput("append", Map.of("text", "never")));

        assertThat(runner.run("a".repeat(3_000), steps)).isEqualTo(new RunResult.Rejected(List.of(
                new StepError(1, null, ErrorCode.RESULT_TOO_LONG, "Result is longer than 3,000 characters."))));
    }

    static Stream<Arguments> replacementsJavaRejects() {
        return Stream.of(
                Arguments.of("$", "Replacement ends with a lone $; write \\$ for a dollar sign."),
                Arguments.of("a\\", "Replacement ends with a lone \\; write \\\\ for a backslash."),
                Arguments.of("$&", "\"$&\" isn't a group reference; write \\$ for a dollar sign."),
                Arguments.of("$<first>", "\"$<\" isn't a group reference; write \\$ for a dollar sign."),
                Arguments.of("$3", "There is no group 3."),
                Arguments.of("${nope}", "There is no group named \"nope\"."),
                Arguments.of("${}", "Write a group name as ${name}."),
                Arguments.of("${first", "Write a group name as ${name}."),
                Arguments.of("${1st}", "Write a group name as ${name}."));
    }

    @ParameterizedTest(name = "\"{0}\" -> {1}")
    @MethodSource("replacementsJavaRejects")
    void regexRejectsAReplacementJavaWouldRejectEvenWithoutAMatch(String replacement, String message) {
        assertThat(run("no digits", "regex", Map.of("pattern", "(?<first>\\d)(\\d)", "replacement", replacement)))
                .isEqualTo(rejected("replacement", ErrorCode.INVALID_PATTERN, message));
    }

    @ParameterizedTest
    @ValueSource(strings = {"$2-$1", "$0$0", "$10", "$1$20", "${first}!", "\\$\\\\\\n", "plain", ""})
    void regexReplacesExactlyAsJavaReplaceAllDoes(String replacement) {
        var input = "12 34 5";
        var pattern = "(?<first>\\d)(\\d)?";
        var expected = Pattern.compile(pattern).matcher(input).replaceAll(replacement);

        assertThat(run(input, "regex", Map.of("pattern", pattern, "replacement", replacement)))
                .isEqualTo(new RunResult.Completed(expected, List.of(expected)));
    }

    @Test
    void regexReportsAPatternThatRecursesTooDeepForTheTextAsATimeout() {
        // Java's engine recurses once per repetition of a group, so this overflows the stack on long text.
        var steps = List.of(
                new StepInput("append", Map.of("text", "")),
                new StepInput("regex", Map.of("pattern", "(a|b)*")),
                new StepInput("append", Map.of("text", "never")));

        assertThat(runner.run("a".repeat(3_000), steps)).isEqualTo(new RunResult.Rejected(List.of(
                new StepError(1, null, ErrorCode.PATTERN_TIMEOUT, "Pattern is too complex for this text."))));
    }
}
