package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class ContentCheckTest {

    private static final List<StepInput> UPPERCASE = List.of(new StepInput("uppercase", Map.of()));

    private static ChainRunner runnerWith(ContentChecker checker) {
        return new ChainRunner(TransformationRegistry.builtIn(), checker);
    }

    @Test
    void flaggedInputTextIsAnInputErrorAndNothingRuns() {
        var runner = runnerWith(text -> true);

        assertThat(runner.run("bad text", UPPERCASE, true)).isEqualTo(new RunResult.Rejected(List.of(
                new InputError(ErrorCode.INPUT_FLAGGED, "Input text was flagged as harmful and wasn't run."))));
    }

    @Test
    void anUnreachableCheckStopsTheRunInsteadOfLettingTheTextThrough() {
        var runner = runnerWith(text -> {
            throw new ContentCheckUnavailableException("the service is down");
        });

        assertThatThrownBy(() -> runner.run("any text", UPPERCASE, true))
                .isInstanceOf(ContentCheckUnavailableException.class);
    }

    @Test
    void textIsNotCheckedWhenTheContentCheckIsOff() {
        var runner = runnerWith(text -> {
            throw new AssertionError("the checker must not be asked");
        });

        assertThat(runner.run("bad text", UPPERCASE, false))
                .isEqualTo(new RunResult.Completed("BAD TEXT", List.of("BAD TEXT")));
    }

    @Test
    void textIsNotCheckedWhenTheChainCouldNotRunAnyway() {
        var runner = runnerWith(text -> {
            throw new AssertionError("the checker must not be asked");
        });

        var result = runner.run("text", List.of(new StepInput("missing", Map.of())), true);

        assertThat(result).isInstanceOf(RunResult.Rejected.class);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "   ", "\n\t"})
    void blankInputTextHasNothingToCheckSoTheCheckerIsNotAsked(String blank) {
        var runner = runnerWith(text -> {
            throw new AssertionError("the checker must not be asked");
        });

        assertThat(runner.run(blank, UPPERCASE, true)).isEqualTo(new RunResult.Completed(blank, List.of(blank)));
    }
}
