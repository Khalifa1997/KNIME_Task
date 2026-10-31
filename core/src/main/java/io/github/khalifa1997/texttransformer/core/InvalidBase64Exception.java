package io.github.khalifa1997.texttransformer.core;

/**
 * Thrown from {@link Transformation#apply} when the text reaching a decode Step isn't Base64 of UTF-8
 * text; the runner turns it into a Step error.
 */
final class InvalidBase64Exception extends RuntimeException {

    InvalidBase64Exception(String message) {
        super(message, null, false, false);
    }
}
