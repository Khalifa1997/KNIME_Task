package io.github.khalifa1997.texttransformer.app;

import java.util.Map;
import tools.jackson.core.JsonParser;
import tools.jackson.core.JsonToken;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.ValueDeserializer;

/** Only the container is constrained here; raw Field values belong to core. */
final class FieldValuesDeserializer extends ValueDeserializer<Map<String, Object>> {
    @Override
    public Map<String, Object> deserialize(JsonParser parser, DeserializationContext context) {
        if (!parser.hasToken(JsonToken.START_OBJECT)) {
            return context.reportInputMismatch(Map.class, "Expected an object");
        }
        return context.readValue(parser, context.getTypeFactory().constructMapType(Map.class, String.class, Object.class));
    }

    @Override
    public Object getNullValue(DeserializationContext context) {
        return context.reportInputMismatch(Map.class, "Expected an object");
    }

    @Override
    public Object getAbsentValue(DeserializationContext context) {
        return Map.of();
    }
}
