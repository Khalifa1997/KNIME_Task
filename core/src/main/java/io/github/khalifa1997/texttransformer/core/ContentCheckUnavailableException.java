package io.github.khalifa1997.texttransformer.core;

/** The Content check could not give an answer, so the Input text must not be run unchecked. */
public final class ContentCheckUnavailableException extends RuntimeException {

    public ContentCheckUnavailableException(String message) {
        super(message);
    }

    public ContentCheckUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
