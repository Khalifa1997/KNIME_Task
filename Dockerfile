# Optional third way to run the app: `docker compose up --build`.
# Build stage: the same `./mvnw package` as a local build (Java tests, lint, type-check, Vitest).
FROM eclipse-temurin:25-jdk AS build
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -ntp package

# Run stage: only the JRE and the one jar, which serves the API and the built frontend.
FROM eclipse-temurin:25-jre
WORKDIR /app
COPY --from=build /workspace/app/target/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
