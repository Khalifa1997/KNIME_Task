package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

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
}
