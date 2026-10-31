package io.github.khalifa1997.texttransformer.core;

/** Screens Input text for harmful content, usually by asking an outside service. */
@FunctionalInterface
public interface ContentChecker {

    /** Whether the text is harmful and must not be run. */
    boolean flags(String text);
}
