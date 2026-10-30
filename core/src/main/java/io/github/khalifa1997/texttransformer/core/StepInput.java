package io.github.khalifa1997.texttransformer.core;

import java.util.Map;

/** One Step as the caller describes it: which Transformation, with which Field values. */
public record StepInput(String transformationId, Map<String, Object> values) {}
