package io.github.khalifa1997.texttransformer.core;

/** Thrown from {@link Transformation#apply} when a pattern runs past its deadline; the runner turns it into a Step error. */
final class PatternTimeoutException extends RuntimeException {

    PatternTimeoutException() {
        super("Pattern took too long.", null, false, false);
    }
}
