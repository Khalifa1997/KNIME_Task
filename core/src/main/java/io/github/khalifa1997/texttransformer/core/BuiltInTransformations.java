package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/** The explicit list of Transformations. Its order is the palette order. */
final class BuiltInTransformations {

    private BuiltInTransformations() {}

    static List<Transformation> all() {
        return List.of(
                new Uppercase(),
                new Lowercase());
    }
}
