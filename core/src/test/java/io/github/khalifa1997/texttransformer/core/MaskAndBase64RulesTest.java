package io.github.khalifa1997.texttransformer.core;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** The rules only Trim, Mask and the Base64 Transformations have, seen through the runner. */
class MaskAndBase64RulesTest {

    private final ChainRunner runner = new ChainRunner(TransformationRegistry.builtIn());

    private RunResult run(String input, String id, Map<String, Object> values) {
        return runner.run(input, List.of(new StepInput(id, values)));
    }

    private static RunResult.Rejected rejected(String field, ErrorCode errorCode, String message) {
        return new RunResult.Rejected(List.of(new StepError(0, field, errorCode, message)));
    }

    @Test
    void trimRejectsAnUnknownSide() {
        assertThat(run(" a ", "trim", Map.of("sides", "middle")))
                .isEqualTo(rejected("sides", ErrorCode.NOT_A_CHOICE, "Trim from must be one of: Both ends, Start, End."));
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "**"})
    void maskRejectsAMaskCharacterThatIsNotOneCharacter(String character) {
        assertThat(run("secret", "mask", Map.of("character", character)))
                .isEqualTo(rejected("character", ErrorCode.NOT_ONE_CHARACTER,
                        "Mask character must be exactly one character."));
    }

    @Test
    void maskRejectsANegativeKeep() {
        assertThat(run("secret", "mask", Map.of("keepEnd", -1)))
                .isEqualTo(rejected("keepEnd", ErrorCode.BELOW_MIN, "Keep at end must be 0 or more."));
    }

    @Test
    void base64DecodeStopsTheChainAtTheStepWhenTheTextIsNotBase64() {
        var steps = List.of(
                new StepInput("append", Map.of("text", "!")),
                new StepInput("base64decode", Map.of()),
                new StepInput("append", Map.of("text", "never")));

        assertThat(runner.run("SGVsbG8=", steps)).isEqualTo(new RunResult.Rejected(List.of(
                new StepError(1, null, ErrorCode.INVALID_BASE64, "Text isn't valid Base64."))));
    }

    @Test
    void base64DecodeSuggestsTheOtherAlphabet() {
        assertThat(run("Pz8-", "base64decode", Map.of())).isEqualTo(rejected(null, ErrorCode.INVALID_BASE64,
                "Text isn't valid Base64; it looks URL-safe, so turn on URL-safe alphabet."));
        assertThat(run("Pz8+", "base64decode", Map.of("urlSafe", true))).isEqualTo(rejected(null,
                ErrorCode.INVALID_BASE64,
                "Text isn't valid URL-safe Base64; it looks standard, so turn off URL-safe alphabet."));
    }

    @Test
    void base64DecodeRejectsBytesThatAreNotUtf8() {
        // 0xFF 0xFE is valid Base64 but never valid UTF-8.
        assertThat(run("//4=", "base64decode", Map.of()))
                .isEqualTo(rejected(null, ErrorCode.INVALID_BASE64, "Decoded bytes aren't UTF-8 text."));
    }

    @Test
    void base64EncodeRoundTripsThroughDecode() {
        var text = "Grüße, \uD83D\uDE00\nzweite Zeile";
        var steps = List.of(new StepInput("base64encode", Map.of()), new StepInput("base64decode", Map.of()));

        assertThat(runner.run(text, steps)).isInstanceOfSatisfying(RunResult.Completed.class,
                completed -> assertThat(completed.output()).isEqualTo(text));
    }

    @Test
    void base64EncodeStopsWhenTheResultGrowsPastTheLimit() {
        assertThat(run("a".repeat(3_000), "base64encode", Map.of())).isEqualTo(rejected(null,
                ErrorCode.RESULT_TOO_LONG, "Result is longer than 3,000 characters."));
    }
}
