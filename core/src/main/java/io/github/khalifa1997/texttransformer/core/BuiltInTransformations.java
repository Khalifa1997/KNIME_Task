package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/** The explicit list of Transformations. Its order is the palette order. */
final class BuiltInTransformations {

    private BuiltInTransformations() {}

    static List<Transformation> all() {
        return List.of(
                new Replace(),
                new Append(),
                new Prepend(),
                new Substring(),
                new RegexReplace(),
                new Uppercase(),
                new Lowercase(),
                new Reverse(),
                new Trim(),
                new Mask(),
                new Base64Encode(),
                new Base64Decode());
    }
}
