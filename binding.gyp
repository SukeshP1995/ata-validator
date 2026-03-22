{
  "targets": [
    {
      "target_name": "ata",
      "sources": [
        "binding/ata_napi.cpp",
        "src/ata.cpp",
        "deps/simdjson/simdjson.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "include",
        "deps/simdjson",
        "<!@(node -p \"process.platform === 'darwin' ? '/opt/homebrew/opt/re2/include' : '/usr/include'\")",
        "<!@(node -p \"process.platform === 'darwin' ? '/opt/homebrew/opt/abseil/include' : '/usr/include'\")"
      ],
      "libraries": [
        "<!@(node -p \"process.platform === 'darwin' ? '-L/opt/homebrew/opt/re2/lib -lre2' : '-lre2'\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "cflags_cc": ["-std=c++20"],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        ["OS=='mac'", {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LANGUAGE_STANDARD": "c++20",
            "MACOSX_DEPLOYMENT_TARGET": "12.0"
          }
        }],
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "AdditionalOptions": ["/std:c++20", "/EHsc"]
            }
          }
        }]
      ]
    }
  ]
}
