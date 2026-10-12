import { marked, type Token, type Tokens } from 'marked';
import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { styles, useColors } from '../navigation/styles';

export function MarkdownResult({ text }: { text: string }) {
  const colors = useColors();
  const tokens = useMemo(() => marked.lexer(text), [text]);
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState(0);
  const textStyle = [styles.text, { color: colors.text }];
  function renderTokens(items: Token[] = [], path = 'result'): ReactNode {
    return items.map((token, index) => {
      const key = `${path}-${index}`;
      switch (token.type) {
        case 'space':
          return null;
        case 'heading':
          return (
            <Text
              key={key}
              accessibilityRole="header"
              style={[textStyle, local.bold, { fontSize: 29 - token.depth * 2 }]}
            >
              {renderTokens(token.tokens, key)}
            </Text>
          );
        case 'paragraph':
          return (
            <Text key={key} style={textStyle}>
              {renderTokens(token.tokens, key)}
            </Text>
          );
        case 'strong':
        case 'em':
        case 'del':
          return (
            <Text
              key={key}
              style={
                token.type === 'strong'
                  ? local.bold
                  : token.type === 'em'
                    ? local.italic
                    : local.deleted
              }
            >
              {renderTokens(token.tokens, key)}
            </Text>
          );
        case 'codespan':
          return (
            <Text key={key} style={local.code}>
              {token.text}
            </Text>
          );
        case 'code':
          return (
            <Text key={key} style={[textStyle, local.code]}>
              {token.text}
            </Text>
          );
        case 'blockquote':
          return (
            <View key={key} style={[local.quote, { borderColor: colors.muted }]}>
              {renderTokens(token.tokens, key)}
            </View>
          );
        case 'list':
          return (
            <View key={key} style={local.blocks}>
              {token.items.map((item: Tokens.ListItem, i: number) => (
                <View key={i} style={local.listRow}>
                  <Text style={textStyle}>
                    {token.ordered ? `${Number(token.start) + i}.` : '•'}{' '}
                  </Text>
                  <View style={local.listBody}>{renderTokens(item.tokens, `${key}-${i}`)}</View>
                </View>
              ))}
            </View>
          );
        case 'link':
          return (
            <Text
              key={key}
              testID={`markdown-link-${key}`}
              accessibilityRole="link"
              accessibilityLabel={`${token.text}, opens in browser`}
              style={local.link}
              onPress={() => {
                void Linking.openURL(token.href).catch(() => {});
              }}
            >
              {renderTokens(token.tokens, key)}
            </Text>
          );
        case 'image':
          return (
            <Text key={key} style={textStyle}>
              {token.text || token.href}
            </Text>
          );
        case 'html':
          return (
            <Text key={key} style={textStyle}>
              {token.raw.trimEnd()}
            </Text>
          );
        case 'br':
          return '\n';
        case 'text':
          return token.tokens ? (
            <Text key={key} style={textStyle}>
              {renderTokens(token.tokens, key)}
            </Text>
          ) : (
            token.text
          );
        default:
          return (
            <Text key={key} style={textStyle}>
              {token.raw}
            </Text>
          );
      }
    });
  }
  return (
    <>
      <View testID="run-detail-result-viewport" style={!expanded && local.collapsed}>
        <View
          testID="run-detail-result-content"
          style={local.blocks}
          onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        >
          {renderTokens(tokens)}
        </View>
      </View>
      {height > 144 && (
        <Pressable
          testID="run-detail-result-toggle"
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Show less' : 'Show more'}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={textStyle}>{expanded ? 'Show less' : 'Show more'}</Text>
        </Pressable>
      )}
    </>
  );
}

const local = StyleSheet.create({
  collapsed: { maxHeight: 144, overflow: 'hidden' },
  blocks: { gap: 12 },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  deleted: { textDecorationLine: 'line-through' },
  code: { fontFamily: 'monospace' },
  quote: { borderLeftWidth: 3, paddingLeft: 12, gap: 12 },
  listRow: { flexDirection: 'row' },
  listBody: { flex: 1, gap: 12 },
  link: { textDecorationLine: 'underline' },
});
