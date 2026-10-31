package io.github.khalifa1997.texttransformer.core;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;

final class Base64Decode implements Transformation {

    @Override
    public String id() {
        return "base64decode";
    }

    @Override
    public String label() {
        return "Base64 decode";
    }

    @Override
    public String description() {
        return "Decodes Base64 back to text, read as UTF-8.";
    }

    @Override
    public List<FieldSpec> fields() {
        return List.of(FieldSpec.bool("urlSafe", "URL-safe alphabet", false));
    }

    @Override
    public String apply(String input, FieldValues values) {
        boolean urlSafe = values.bool("urlSafe");
        // Pasted Base64 is often wrapped over lines; padding is optional, as Java's decoder allows.
        var encoded = input.replaceAll("\\s+", "");
        byte[] bytes;
        try {
            bytes = (urlSafe ? Base64.getUrlDecoder() : Base64.getDecoder()).decode(encoded);
        } catch (IllegalArgumentException e) {
            throw new InvalidBase64Exception(notBase64(encoded, urlSafe));
        }
        try {
            // A strict decoder, so bytes that aren't UTF-8 fail instead of turning into U+FFFD.
            return StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            throw new InvalidBase64Exception("Decoded bytes aren't UTF-8 text.");
        }
    }

    private static String notBase64(String encoded, boolean urlSafe) {
        if (!urlSafe && (encoded.indexOf('-') >= 0 || encoded.indexOf('_') >= 0)) {
            return "Text isn't valid Base64; it looks URL-safe, so turn on URL-safe alphabet.";
        }
        if (urlSafe && (encoded.indexOf('+') >= 0 || encoded.indexOf('/') >= 0)) {
            return "Text isn't valid URL-safe Base64; it looks standard, so turn off URL-safe alphabet.";
        }
        return "Text isn't valid Base64.";
    }
}
