package io.github.khalifa1997.texttransformer.core;

/**
 * Thrown from {@link Transformation#apply} when a pattern runs past its deadline, or recurses too deep
 * for the text; the runner turns it into a Step error.
 */
final class PatternTimeoutException extends RuntimeException {

    PatternTimeoutException() {
        this("Pattern took too long.");
    }

    PatternTimeoutException(String message) {
        super(message, null, false, false);
    }
}
