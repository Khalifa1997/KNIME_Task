package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/**
 * A configurable setting a Transformation declares. Metadata and validation both come from it, so
 * they can't drift.
 *
 * @param min used only by {@link Type#INTEGER}, otherwise {@code null}
 * @param max used only by {@link Type#INTEGER}, otherwise {@code null}
 * @param options the Choices of a {@link Type#SELECT} Field, otherwise {@code null}
 */
public record FieldSpec(
        String name,
        String label,
        Type type,
        boolean required,
        Object defaultValue,
        Integer min,
        Integer max,
        List<Choice> options) {

    public enum Type {
        TEXT,
        INTEGER,
        BOOLEAN,
        SELECT
    }

    /** One of the fixed values a select Field allows. */
    public record Choice(String value, String label) {}
}
