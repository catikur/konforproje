import { BadRequestException, PipeTransform } from "@nestjs/common";
import { ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      const messages = result.error.issues.map((i) => {
        const path = i.path.length ? `${i.path.join(".")}: ` : "";
        return `${path}${i.message}`;
      });
      throw new BadRequestException(messages);
    }
    return result.data;
  }
}

export const zodPipe = (schema: ZodSchema) => new ZodValidationPipe(schema);
