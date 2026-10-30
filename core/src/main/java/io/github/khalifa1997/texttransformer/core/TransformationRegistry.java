package io.github.khalifa1997.texttransformer.core;

import java.util.List;
import java.util.Optional;

/** The Transformations on offer, in palette order. */
public final class TransformationRegistry {

    private final List<Transformation> transformations;

    private TransformationRegistry(List<Transformation> transformations) {
        this.transformations = List.copyOf(transformations);
    }

    public static TransformationRegistry builtIn() {
        return new TransformationRegistry(BuiltInTransformations.all());
    }

    /** Every Transformation, in palette order. */
    public List<Transformation> all() {
        return transformations;
    }

    public Optional<Transformation> find(String id) {
        return transformations.stream().filter(t -> t.id().equals(id)).findFirst();
    }
}
