package io.github.khalifa1997.texttransformer.core;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

final class Base64Encode implements Transformation {

    @Override
    public String id() {
        return "base64encode";
    }

    @Override
    public String label() {
        return "Base64 encode";
    }

    @Override
    public String description() {
        return "Encodes the text as Base64, from its UTF-8 bytes.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(FieldSpec.bool("urlSafe", "URL-safe alphabet", false));
    }

    @Override
    public String apply(String input, FieldValues values) {
        var encoder = values.bool("urlSafe") ? Base64.getUrlEncoder() : Base64.getEncoder();
        return encoder.encodeToString(input.getBytes(StandardCharsets.UTF_8));
    }
}
