package io.github.khalifa1997.texttransformer.core;

import java.util.List;

/**
 * A kind of change that can be applied to text, such as Replace or Uppercase.
 *
 * <p>Implementations are stateless singletons. Adding one takes this class plus one line in
 * {@link BuiltInTransformations}; the frontend renders it from metadata with no change.
 */
public interface Transformation {

    /** Lowercase id, stable across releases; the frontend stores it in Saved sessions. */
    String id();

    String label();

    /** One sentence, shown in the palette and used as the accessible description. */
    String description();

    /** The Fields this Transformation declares, in display order. */
    List<FieldSpec> fields();

    /** Applies this Transformation using values already coerced and defaulted by the runner. */
    String apply(String input, FieldValues values);
}
