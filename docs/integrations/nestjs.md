# NestJS

ata fits into NestJS as a [validation pipe](https://docs.nestjs.com/pipes). The pipe validates the request payload before it reaches the controller method.

## Install

```bash
npm install ata-validator @nestjs/common
```

## Validation pipe

```ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common'
import { Validator } from 'ata-validator'

@Injectable()
export class AtaValidationPipe implements PipeTransform {
  private readonly validator: Validator

  constructor(schema: object, opts?: { abortEarly?: boolean; coerceTypes?: boolean; removeAdditional?: boolean }) {
    this.validator = new Validator(schema, opts)
  }

  transform(value: unknown, metadata: ArgumentMetadata) {
    const r = this.validator.validate(value)
    if (!r.valid) {
      throw new BadRequestException({
        error: 'validation failed',
        errors: r.errors,
      })
    }
    return value
  }
}
```

## Using the pipe on a controller

```ts
import { Body, Controller, Post } from '@nestjs/common'
import { AtaValidationPipe } from './ata-validation.pipe'

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', minimum: 1 },
    name: { type: 'string', minLength: 1 },
    email: { type: 'string' },
  },
  required: ['id', 'name', 'email'],
}

@Controller('users')
export class UserController {
  @Post()
  create(
    @Body(new AtaValidationPipe(userSchema)) body: { id: number; name: string; email: string },
  ) {
    return { ok: true, id: body.id }
  }
}
```

## Global pipe for a controller

Instead of attaching the pipe inline on every method, apply it at the class level when one schema covers the whole controller:

```ts
import { UsePipes, Controller, Post, Body } from '@nestjs/common'
import { AtaValidationPipe } from './ata-validation.pipe'

@Controller('users')
@UsePipes(new AtaValidationPipe(userSchema))
export class UserController {
  @Post()
  create(@Body() body: any) {
    return { ok: true, id: body.id }
  }
}
```

## Typed pipes with `ata compile`

To get a typed controller parameter, pair the pipe with a compiled validator:

```bash
npx ata compile schemas/user.json -o src/user.validator.mjs --name User
```

```ts
import { Controller, Post, Body, BadRequestException } from '@nestjs/common'
import { validate, type User } from './schemas/user.validator.mjs'

@Controller('users')
export class UserController {
  @Post()
  create(@Body() body: unknown): { ok: true; id: number } {
    const r = validate(body)
    if (!r.valid) {
      throw new BadRequestException({ errors: r.errors })
    }
    const user = body as User
    return { ok: true, id: user.id }
  }
}
```

At this point the pipe is unnecessary; the compiled validator is called inline and the type is narrowed by the `.d.mts` file.

## Abort-early variant

For public endpoints where stub errors are acceptable:

```ts
@Post()
create(@Body(new AtaValidationPipe(userSchema, { abortEarly: true })) body: any) {
  return { ok: true }
}
```

Invalid requests receive `{ errors: [{ message: 'validation failed' }] }` but the invalid path is roughly 4x faster per request.

## Notes

- For DTO-style patterns using `class-validator` / `class-transformer`, the built-in `ValidationPipe` remains the idiomatic NestJS approach. The pattern here is for projects that keep schemas as JSON files or receive them from an external source.
- Global registration via `app.useGlobalPipes(new AtaValidationPipe(...))` is possible but requires schemas that apply to every endpoint, rare in practice.
- To combine with class-validator DTOs, keep the built-in `ValidationPipe` for DTOs and apply `AtaValidationPipe` per method where you consume JSON Schemas.
