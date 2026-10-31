package io.github.khalifa1997.texttransformer.core;

/** Stable business error categories; wire spelling is the caller's responsibility. */
public enum ErrorCode {
    INPUT_TOO_LONG,
    TOO_MANY_STEPS,
    INPUT_FLAGGED,
    UNKNOWN_TRANSFORMATION,
    REQUIRED,
    WRONG_TYPE,
    BELOW_MIN,
    ABOVE_MAX,
    TOO_LONG,
    NOT_A_CHOICE,
    START_AFTER_END,
    INVALID_PATTERN,
    PATTERN_TIMEOUT,
    RESULT_TOO_LONG
}
