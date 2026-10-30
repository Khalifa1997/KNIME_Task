package io.github.khalifa1997.texttransformer.core;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The typed, defaulted Field values supplied to a Transformation.
 *
 * <p>Only Fields declared by the Transformation are retained. A missing or null optional value is
 * replaced with the Field's default value. Validation and error reporting are added by the Step
 * errors work; this class keeps applying Transformations independent of Jackson's raw values.
 */
public final class FieldValues {

    private final Map<String, Object> values;

    private FieldValues(Map<String, Object> values) {
        // Optional Fields may deliberately default to null (for example an open-ended index).
        this.values = Collections.unmodifiableMap(new LinkedHashMap<>(values));
    }

    public static FieldValues of(List<FieldSpec> fields, Map<String, Object> supplied) {
        var values = new LinkedHashMap<String, Object>();
        for (var field : fields) {
            var value = supplied.get(field.name());
            if (value == null && !field.required()) {
                value = field.defaultValue();
            }
            values.put(field.name(), value);
        }
        return new FieldValues(values);
    }

    public String string(String name) {
        return (String) values.get(name);
    }

    public Integer integer(String name) {
        return (Integer) values.get(name);
    }

    public Integer optionalInteger(String name) {
        return (Integer) values.get(name);
    }

    public boolean bool(String name) {
        return (Boolean) values.get(name);
    }

    public String choice(String name) {
        return (String) values.get(name);
    }
}
