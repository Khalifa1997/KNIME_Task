package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ChainRunnerTest {

    private final ChainRunner runner = new ChainRunner(TransformationRegistry.builtIn(), text -> false);

    private static StepInput step(String transformationId) {
        return new StepInput(transformationId, Map.of());
    }

    @Test
    void anEmptyChainOutputsTheInputText() {
        assertThat(runner.run("Hello", List.of(), false))
                .isEqualTo(new RunResult.Completed("Hello", List.of()));
    }

    @Test
    void eachStepReceivesThePreviousStepsResult() {
        var result = runner.run("Hello World", List.of(step("uppercase"), step("lowercase")), false);

        assertThat(result)
                .isEqualTo(new RunResult.Completed("hello world", List.of("HELLO WORLD", "hello world")));
    }

    @Test
    void theOutputIsTheLastStepsResult() {
        var result = runner.run("abc", List.of(step("lowercase"), step("uppercase")), false);

        assertThat(result).isInstanceOfSatisfying(
                RunResult.Completed.class, completed -> assertThat(completed.output()).isEqualTo("ABC"));
    }

    @Test
    void aStepAppliesItsFieldValuesAndMissingOnesTakeTheirDefault() {
        var result = runner.run("a-b-a", List.of(
                new StepInput("replace", Map.of("search", "a", "replacement", "x")),
                new StepInput("append", Map.of())), false);

        assertThat(result).isEqualTo(new RunResult.Completed("x-b-x", List.of("x-b-x", "x-b-x")));
    }
}
