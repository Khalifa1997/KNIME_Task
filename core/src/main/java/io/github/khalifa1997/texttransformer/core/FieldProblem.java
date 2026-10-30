package io.github.khalifa1997.texttransformer.core;

/** A Transformation-specific problem; null field means the whole Step. */
public record FieldProblem(String field, ErrorCode code, String message) {}
