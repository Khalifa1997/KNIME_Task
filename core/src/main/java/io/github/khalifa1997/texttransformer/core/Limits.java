package io.github.khalifa1997.texttransformer.core;

/**
 * The size limits a Chain must stay within. Lengths count UTF-16 units, as Java {@code
 * String.length()} and JS {@code string.length} do.
 */
public record Limits(int maxInputLength, int maxSteps) {

    public static final Limits DEFAULT = new Limits(3_000, 30);
}
