# Backend image for Render (or any Docker host).
# Build stage: Maven builds core, frontend (Node is installed into target/ by the plugin) and app.
FROM eclipse-temurin:25-jdk AS build
WORKDIR /src
COPY . .
RUN chmod +x mvnw && ./mvnw -B -pl app -am package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /src/app/target/app.jar app.jar
# Keep the heap inside small free-tier containers (Render free: 512 MB).
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
