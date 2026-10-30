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

    public static FieldSpec requiredText(String name, String label) {
        return new FieldSpec(name, label, Type.TEXT, true, null, null, null, null);
    }

    public static FieldSpec text(String name, String label, String defaultValue) {
        return new FieldSpec(name, label, Type.TEXT, false, defaultValue, null, null, null);
    }

    public static FieldSpec integer(
            String name, String label, boolean required, Integer defaultValue, Integer min, Integer max) {
        return new FieldSpec(name, label, Type.INTEGER, required, defaultValue, min, max, null);
    }

    public static FieldSpec bool(String name, String label, boolean defaultValue) {
        return new FieldSpec(name, label, Type.BOOLEAN, false, defaultValue, null, null, null);
    }

    public static FieldSpec select(String name, String label, String defaultValue, List<Choice> options) {
        return new FieldSpec(name, label, Type.SELECT, false, defaultValue, null, null, List.copyOf(options));
    }

    /** One of the fixed values a select Field allows. */
    public record Choice(String value, String label) {}
}
