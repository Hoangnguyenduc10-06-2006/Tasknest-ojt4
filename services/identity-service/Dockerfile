FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache curl && addgroup -S tasknest && adduser -S tasknest -G tasknest
WORKDIR /app
COPY services/identity-service/target/identity-service-0.1.0-SNAPSHOT.jar app.jar
USER tasknest
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65.0", "-jar", "/app/app.jar"]
