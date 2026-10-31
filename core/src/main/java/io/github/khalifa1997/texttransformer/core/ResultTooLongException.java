package io.github.khalifa1997.texttransformer.core;

/**
 * Thrown from {@link Transformation#apply} when a result passes the length limit while it is still
 * being built, so it never grows unbounded; the runner turns it into a Step error.
 */
final class ResultTooLongException extends RuntimeException {

    ResultTooLongException() {
        super(null, null, false, false);
    }
}
