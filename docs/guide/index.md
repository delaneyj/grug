# Getting Started

If you are interested to learn more about grug before trying it, check out the [Introduction](./introduction) section.

## Scaffolding Your First grug Project

::: tip Compatibility Note
grug requires [Node.js](https://nodejs.org/en/) version >=12.0.0.
:::

With NPM:

```bash
$ npm init @delaneyj/app
```

With Yarn:

```bash
$ yarn create @delaneyj/app
```

Then follow the prompts!

You can also directly specify the project name and the template you want to use via additional command line options. For example, to scaffold a grug + Vue project, run:

```bash
npm init @delaneyj/app my-vue-app --template vue
```

Supported template presets include:

- `vanilla`
- `vue`
- `vue-ts`
- `react`
- `react-ts`
- `preact`
- `preact-ts`

See [@delaneyj/create-app](https://github.com/delaneyj/grug/tree/main/packages/create-app) for more details on each template.

## Command Line Interface

In a project where grug is installed, you can use the `grug` binary in your npm scripts, or run it directly with `npx grug`. Here is the default npm scripts in a scaffolded grug project:

```json
{
  "scripts": {
    "dev": "grug",
    "build": "grug build"
  }
}
```

You can specify additional CLI options like `--port` or `--https`. For a full list of CLI options, run `npx grug --help` in your project.

## Project Root

Since grug is a dev server, it has the concept of a "root directory" from which your files are served from, similar to a static file server (although much more powerful).

Running `grug` starts the dev server using the current working directory as root. You can specify an alternative root with `grug serve some/sub/dir`.

grug will serve **`<root>/index.html`** when you open the server's local address. It is also used as the default build entry point. Unlike some bundlers that treat HTML as an afterthought, grug treats HTML files as part of the application graph (similar to Parcel). Therefore you should treat `index.html` as part of your source code instead of a static file. grug also supports [multi-page apps](./build#multi-page-app) with multiple `.html` entry points.

grug will automatically pick up **`<root>/grug.config.js`** if there is one. You can also explicitly specify a config file to use via the `--config <file>` CLI option.

Unlike a static file server, grug can actually resolve and serve dependencies located anywhere on your file system, even if they are out of the project root. This allows grug to work properly inside a sub package of a monorepo.

## Using Unreleased Commits

If you can't wait for a new release to test the latest features, you will need to clone the [grug repo](https://github.com/delaneyj/grug) to your local machine and then build and link it yourself ([Yarn 1.x](https://classic.yarnpkg.com/lang/en/) is required):

```bash
git clone https://github.com/delaneyj/grug.git
cd grug
yarn
cd packages/grug
yarn build
yarn link
```

Then go to your grug based project and run `yarn link grug`. Now restart the development server (`yarn dev`) to ride on the bleeding edge!
